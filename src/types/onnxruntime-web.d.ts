// onnxruntime-web's package.json "exports" has no "types" condition, so under
// bundler resolution TypeScript cannot find the typings it ships. They are a
// thin re-export of onnxruntime-common, which resolves fine, so say so here.
declare module "onnxruntime-web" {
  export * from "onnxruntime-common";
}

declare module "onnxruntime-web/webgpu" {
  export * from "onnxruntime-common";
}
