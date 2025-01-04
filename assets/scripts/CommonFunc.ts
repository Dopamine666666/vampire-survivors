import { _decorator, Component, Mat4, Node, Rect, UITransform, Vec3 } from 'cc';

/**
 * 获取节点世界坐标系下的包围盒，不包含子节点
 * */
export const GetSelfBoundingBox = (node: Node) => {
    const localBoundingBox = node.getComponent(UITransform).getBoundingBox();
    let worldMatrix: Mat4 = new Mat4();
    node.parent.getWorldMatrix(worldMatrix);
    let worldBoundingBox: Rect = new Rect();
    worldBoundingBox = localBoundingBox.transformMat4(worldMatrix);
    return worldBoundingBox;
}

export const GetLimitPos = (unitNode: Node, mapNode: Node) => {
    const unitUtf = unitNode.getComponent(UITransform);
    const mapUtf = mapNode.getComponent(UITransform);

    const mapBoundingBox = GetSelfBoundingBox(mapNode);
    const xMin = mapBoundingBox.xMin + unitUtf.width / 2;
    const xMax = mapBoundingBox.xMax - unitUtf.width / 2;
    const yMin = mapBoundingBox.yMin + unitUtf.height / 2;
    const yMax = mapBoundingBox.yMax - unitUtf.height / 2;
    return {xMin, xMax, yMin, yMax};
}

export const SetPosInLimit = (limitPos: {xMin: number, xMax: number, yMin: number, yMax: number}, out: Vec3) => {
    out.x = Math.max(Math.min(out.x, limitPos.xMax), limitPos.xMin);
    out.y = Math.max(Math.min(out.y, limitPos.yMax), limitPos.yMin);
    return out;
}


