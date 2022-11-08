const helpers = require("./helpers");
const path = require("path");

const hlslShaderReflector = helpers.resolveTool({
  name: "hlsl-shader-reflector",
});

module.exports.reflectHLSLShader = async function reflectHLSLShader(
  inputPath,
  version
) {
  const profile = versionToProfile(inputPath, version);
  const identifier = helpers.filenameToIdentifier(inputPath);
  const shaderReflection = await getShaderReflection(inputPath, profile);
  const typeContainer = toTypeContainer(shaderReflection);
  const shaderTypes = typeContainer.dump();
  await checkShader(inputPath, shaderTypes, typeContainer.dumpChecks());

  return { profile, identifier, shaderTypes };
};

async function getShaderReflection(filePath, profile) {
  const tmpOutput = helpers.tmpFile(".json");
  await helpers.spawnChildProcess(hlslShaderReflector, [
    "-i",
    filePath,
    "-o",
    tmpOutput,
    "-p",
    profile,
  ]);
  return await helpers.readAsJson(tmpOutput);
}

function versionToProfile(inputPath, version) {
  const splitPath = inputPath.split(".");

  if (splitPath.length < 3 || splitPath[splitPath.length - 1] != "hlsl") {
    throw new Error(
      `invalid path '${inputPath}'. should be like 'some-shader.vs.hlsl'`
    );
  }

  const profile_version = version.replace(".", "_");
  const profile_name = splitPath[splitPath.length - 2];
  return `${profile_name}_${profile_version}`;
}

async function checkShader(fileName, shaderTypes, shaderChecks) {
  try {
    const checkSource = checkProgramSource(shaderTypes, shaderChecks);
    const checkFile = helpers.tmpFile(".cpp");
    const checkExe = helpers.tmpFile(".exe");
    await helpers.writeFileStr(checkFile, checkSource);

    const zig = await helpers.findProgram("zig");
    await helpers.spawnChildProcess(zig, ["cc", checkFile, "-o", checkExe]);

    await helpers.spawnChildProcess(checkExe, []);
  } catch (err) {
    console.error(`fail to check shader: ${fileName}`);
    throw err;
  }
}

const makeEnum = (...arr) => [...arr].reduce((p, c) => ({ ...p, [c]: c }), {});

const or0 = (a, b) => (a || a === 0 ? a : b);

const NodeType = makeEnum("VARIABLE", "CONSTANT_BUFFER");

class PlainStruct {
  name = "";
  members = [];
  size = 0;

  constructor(name, size) {
    this.name = name;
    this.size = size;
  }

  addMember(type, name, size, offset) {
    this.members.push({ type, name, size, offset });
  }

  dump() {
    const memberStrings = [];

    for (const { type, name, size, offset } of this.members) {
      const sizeStr = size || size === 0 ? `${size} bytes` : ``;
      const offsetStr = offset || offset === 0 ? ` offset: ${offset}` : ``;
      memberStrings.push(`  ${type} ${name};   // ${sizeStr} ${offsetStr}`);
    }

    let size = "";
    if (this.size || this.size === 0) {
      size = `// ${this.size} bytes`;
    }

    return [`struct ${this.name} { ${size}`, ...memberStrings, "};"].join("\n");
  }

  dumpChecks() {
    const assertions = [];

    if (this.size || this.size === 0) {
      assertions.push(`check_eq(sizeof(${this.name}), ${this.size});`);
    }

    for (const { type, name, size, offset } of this.members) {
      if (size || size === 0) {
        assertions.push(`check_eq(sizeof(${this.name}::${name}), ${size});`);
      }
      if (offset || offset == 0) {
        assertions.push(
          `check_eq(offsetof(${this.name}, ${name}), ${offset});`
        );
      }
    }

    return assertions.join("\n");
  }
}

class TypeContainer {
  #types = new Map();

  push(type, depth) {
    if (type.name.includes("::<unnamed>")) {
      throw new Error("unnamed types is not yet supported");
    }
    this.#types.set(type.name, { type, depth });
  }

  has(name) {
    return this.#types.has(name);
  }

  setTypeDepth(name, depth) {
    const typeInfo = this.#types.get(name);
    typeInfo.depth = Math.max(typeInfo.depth, depth);
  }

  dump() {
    const types = [...this.#types.values()];
    return types
      .sort((a, b) => b.depth - a.depth)
      .map(({ type }) => type.dump() + "\n")
      .join("\n");
  }

  dumpChecks() {
    return [...this.#types.values()].map((x) => x.type.dumpChecks()).join("\n");
  }
}

function toTypeContainer(shaderReflection) {
  // console.dir(shader, { depth: 4 });
  const typeContainer = new TypeContainer();
  const typeQueue = shaderReflection.map((node) => ({ node, depth: 0 }));

  while (typeQueue.length) {
    const { node, depth } = typeQueue.shift();
    const currentDepth = depth + 1;
    const name = getTypeName(node);

    if (typeContainer.has(name)) {
      typeContainer.setTypeDepth(name, currentDepth);
      continue;
    }

    const size = or0(node.size, (node.typeDesc && node.typeDesc.size) || null);
    const struct = new PlainStruct(name, size);

    for (const variable of node.children) {
      struct.addMember(
        variable.typeDesc.name,
        variable.name,
        variable.size,
        or0(variable.startOffset, variable.typeDesc.offset)
      );
      if (variable.typeDesc.class == "STRUCT") {
        typeQueue.push({ node: variable, depth: currentDepth });
      }
    }

    typeContainer.push(struct, currentDepth);
  }

  // console.log(typeContainer.dump());
  return typeContainer;
}

function getTypeName(node) {
  return node.nodeType == NodeType.CONSTANT_BUFFER
    ? node.typeName
    : node.typeDesc.name;
}

function checkProgramSource(structs, checks) {
  checks = checks
    .split("\n")
    .map((x) => "      " + x)
    .join("\n")
    .trimLeft();

  structs = structs
    .split("\n")
    .map((x) => "    " + x)
    .join("\n")
    .trimLeft();

  return `
    #include <stdio.h>
    #include <stdlib.h>
    #include <stddef.h>

    struct float2 { float x; float y; };
    struct float3 { float x; float y; float z; };
    struct float4 { float x; float y; float z; float w; };

    ${structs}

    bool checks_failed = false;

    #define check_eq(a, b) \\
      if ((a) != (b)) { \\
        printf("\\ncheck "#a" == "#b" failed!\\n"); \\
        printf("  "#a" = %u\\n", (unsigned int)(a)); \\
        checks_failed = true; \\
      } \\

    int main(int, char**) {
      ${checks}
      if (checks_failed) {
        return 1;
      }
      return 0;
    }
  `;
}
