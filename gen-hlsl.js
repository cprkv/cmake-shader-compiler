const helpers = require("./helpers");
const path = require("path");
const { reflectHLSLShaders } = require("./reflect-hlsl");

const fxc = helpers.resolveTool({ name: "fxc" });
const dxc = helpers.resolveTool({ name: "dxc" });

async function compileNew(tmpOutput, inputPath, profile) {
  // console.log("compiling with dxc");
  await helpers.spawnChildProcess(dxc, [
    "-Zi", // Enable debug information
    "-Ges", // Enable strict mode
    "-WX", // Treat warnings as errors
    inputPath,
    "-T",
    profile,
    "-Fo",
    tmpOutput,
  ]);
}

async function compileOld(tmpOutput, inputPath, profile) {
  // console.log("compiling with fxc");
  await helpers.spawnChildProcess(fxc, [
    "/Od", // Disable optimizations
    "/Zi", // Enable debug information
    "/Ges", // Enable strict mode
    "/WX", // Treat warnings as errors
    inputPath,
    "/T",
    profile,
    "/Fo",
    tmpOutput,
  ]);
}

async function genCSO({ inputPath, version, profile, identifier }) {
  const tmpOutput = helpers.tmpFile(".cso");

  if (+version > 5.5) {
    throw new Error("not yet supported... \\_@-@_/");
    await compileNew(tmpOutput, inputPath, profile);
  } else {
    await compileOld(tmpOutput, inputPath, profile);
  }

  const bytes = await helpers.readAsCppBytesArray(tmpOutput);
  console.log(`cso: ${inputPath} -> ${identifier}`);
  return { identifier, bytes };
}

async function genTypes(files, version, dir, namespace) {
  const { shaderInfos, typesFile } = await reflectHLSLShaders(
    files,
    version,
    namespace
  );
  await helpers.writeFileStr(path.join(dir, "shader-types.hpp"), typesFile);
  return shaderInfos;
}

helpers.mainWrapper(async (args) => {
  const version = args[0];
  const dir = args[1];
  const namespace = args[2];
  const files = args.slice(3);

  const shaderInfos = await genTypes(files, version, dir, namespace);
  const shaders = await helpers.withLimitNumCpu(
    shaderInfos.map((shaderInfo) => () => genCSO(shaderInfo))
  );
  await helpers.writeShaders(shaders, dir, "dx", namespace);
});
