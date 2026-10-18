"""Replace every PRelu with Relu/Sub/Mul/Add, which onnxruntime-web's WebGPU
backend implements (1.21 has no PRelu there), and embed the weights."""
import sys, onnx
from onnx import helper, numpy_helper

src, dst = sys.argv[1], sys.argv[2]
m = onnx.load(src)  # pulls the external .data in
inits = {i.name: i for i in m.graph.initializer}
nodes = []
for n in m.graph.node:
    if n.op_type != "PRelu":
        nodes.append(n)
        continue
    x, slope = n.input
    y = n.output[0]
    pos, neg, scaled = f"{y}__pos", f"{y}__neg", f"{y}__scaled"
    nodes += [
        helper.make_node("Relu", [x], [pos]),
        helper.make_node("Sub", [x, pos], [neg]),          # min(x, 0)
        helper.make_node("Mul", [neg, slope], [scaled]),   # slope * min(x, 0)
        helper.make_node("Add", [pos, scaled], [y]),
    ]
    s = numpy_helper.to_array(inits[slope])
    assert s.ndim in (1, 3), s.shape
del m.graph.node[:]
m.graph.node.extend(nodes)
onnx.checker.check_model(m)
onnx.save(m, dst, save_as_external_data=False)
print("slope shape", s.shape, "nodes", len(nodes))
