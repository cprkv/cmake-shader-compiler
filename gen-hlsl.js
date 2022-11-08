const helpers = require("./helpers");
const { reflectHLSLShader } = require("./reflect-hlsl");

const fxc = helpers.resolveTool({ name: "fxc" });
const dxc = helpers.resolveTool({ name: "dxc" });

async function compileNew(tmpOutput, inputPath, profile) {
  console.log("compiling with dxc");
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
  console.log("compiling with fxc");
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

const shaders = [];

async function genCSO(inputPath, version) {
  const { profile, identifier, shaderTypes } = await reflectHLSLShader(
    inputPath,
    version
  );

  const tmpOutput = helpers.tmpFile(".cso");

  if (+version > 5.5) {
    throw new Error("not yet supported... \\_@-@_/");
    await compileNew(tmpOutput, inputPath, profile);
  } else {
    await compileOld(tmpOutput, inputPath, profile);
  }

  const bytes = await helpers.readAsCppBytesArray(tmpOutput);
  shaders.push({ identifier, bytes, shaderTypes });
  console.log(`cso: ${inputPath} -> ${identifier}`);
}

helpers.mainWrapper(async (args) => {
  const version = args[0];
  const dir = args[1];
  const files = args.slice(2);

  await helpers.withLimitNumCpu(files.map((file) => () => genCSO(file, version)));
  await helpers.writeShaders(shaders, dir, "dx");
});
