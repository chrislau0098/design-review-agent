// Figma sandbox 侧 · runs inside Figma plugin's JS sandbox
// 只可用 figma.* API + postMessage · 无 DOM · 无 fetch

const UI_WIDTH = 400;
const UI_HEIGHT = 720;
const MAX_STRUCTURE_NODES = 150;

figma.showUI(__html__, { width: UI_WIDTH, height: UI_HEIGHT, themeColors: true });

type SelectableNode = SceneNode & { exportAsync: FrameNode['exportAsync'] };

interface OutStructureNode {
  id: string;
  name: string;
  type: string;
  characters?: string;
  bbox: [number, number, number, number]; // normalized to Frame · [x,y,w,h] in [0,1]
}
interface InternalStructureNode extends OutStructureNode {
  area: number;
}

function isExportable(node: SceneNode): node is SelectableNode {
  return (
    node.type === 'FRAME' ||
    node.type === 'COMPONENT' ||
    node.type === 'COMPONENT_SET' ||
    node.type === 'INSTANCE' ||
    node.type === 'GROUP' ||
    node.type === 'SECTION'
  );
}

function getSelectedFrame(): SelectableNode | null {
  const sel = figma.currentPage.selection;
  if (sel.length !== 1) return null;
  const node = sel[0]!;
  return isExportable(node) ? node : null;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(binary);
}

// 递归提取 · 保留 semantic 有意义的节点(text / container / vector)· 过滤微碎片
function extractStructure(root: SelectableNode): OutStructureNode[] {
  const frameBbox = root.absoluteBoundingBox;
  if (!frameBbox) return [];
  const fx = frameBbox.x;
  const fy = frameBbox.y;
  const fw = frameBbox.width || 1;
  const fh = frameBbox.height || 1;

  const collected: InternalStructureNode[] = [];

  const walk = (node: SceneNode) => {
    if (!('visible' in node) || node.visible === false) return;
    if ('opacity' in node && typeof node.opacity === 'number' && node.opacity === 0) return;

    const bbox = 'absoluteBoundingBox' in node ? node.absoluteBoundingBox : null;
    if (bbox && bbox.width > 0 && bbox.height > 0) {
      const nx = (bbox.x - fx) / fw;
      const ny = (bbox.y - fy) / fh;
      const nw = bbox.width / fw;
      const nh = bbox.height / fh;

      // 过滤:超出 Frame 太多的碎片 · 或极小的
      const area = nw * nh;
      const relevant =
        area >= 0.001 && // 至少占 Frame 面积 0.1%
        nx > -0.05 &&
        ny > -0.05 &&
        nx + nw < 1.05 &&
        ny + nh < 1.05;

      if (relevant) {
        const entry: InternalStructureNode = {
          id: node.id,
          name: node.name,
          type: node.type,
          bbox: [Math.max(0, nx), Math.max(0, ny), Math.min(1, nw), Math.min(1, nh)],
          area,
        };
        if (node.type === 'TEXT') {
          const text = (node as TextNode).characters;
          if (text) entry.characters = text.slice(0, 60);
        }
        collected.push(entry);
      }
    }

    // 只 recurse 可以有 children 的类型 · InstanceNode 也可以 walk 但会重复 component 内部
    if ('children' in node) {
      for (const child of node.children) walk(child);
    }
  };

  walk(root);

  // 按面积从大到小 · 保住主容器 + 大元素 · 截断到上限
  collected.sort((a, b) => b.area - a.area);
  return collected.slice(0, MAX_STRUCTURE_NODES).map((n) => {
    // 剥除 area(仅用于排序)· 传 backend 不需要
    const { area: _area, ...rest } = n;
    return rest;
  });
}

async function sendSelectionState() {
  const frame = getSelectedFrame();
  if (!frame) {
    figma.ui.postMessage({ type: 'NO_SELECTION' });
    return;
  }
  let thumbnailUrl: string | undefined;
  try {
    const scale = Math.min(0.5, 100 / Math.max(frame.width, frame.height));
    const bytes = await frame.exportAsync({
      format: 'PNG',
      constraint: { type: 'SCALE', value: scale },
    });
    const b64 = toBase64(bytes);
    thumbnailUrl = `data:image/png;base64,${b64}`;
  } catch (e) {
    console.warn('thumbnail export failed', e);
  }
  figma.ui.postMessage({
    type: 'FRAME_SELECTED',
    frameName: frame.name,
    width: frame.width,
    height: frame.height,
    thumbnailUrl,
  });
}

async function exportFullFrame() {
  const frame = getSelectedFrame();
  if (!frame) {
    figma.ui.postMessage({ type: 'EXPORT_FAILED', message: '当前没有选中可导出的 Frame' });
    return;
  }
  try {
    let scale = 2;
    if (Math.max(frame.width, frame.height) > 2000) scale = 1;

    const bytes = await frame.exportAsync({
      format: 'PNG',
      constraint: { type: 'SCALE', value: scale },
    });
    const imageBase64 = toBase64(bytes);
    const frameStructure = extractStructure(frame);

    figma.ui.postMessage({
      type: 'FRAME_EXPORTED',
      imageBase64,
      frameStructure,
    });
  } catch (e) {
    figma.ui.postMessage({
      type: 'EXPORT_FAILED',
      message: e instanceof Error ? e.message : String(e),
    });
  }
}

// Fuzzy fallback:Doubao 返回的 nodeId 找不到时 · 按 characters 或 name 反查
function findNodesByHint(hints: string[]): SceneNode[] {
  if (!hints || hints.length === 0) return [];
  const results: SceneNode[] = [];
  const seen = new Set<string>();

  const walk = (node: SceneNode) => {
    if (!('visible' in node) || node.visible === false) return;
    const searchable =
      node.type === 'TEXT' ? `${node.name} ${(node as TextNode).characters}` : node.name;
    for (const hint of hints) {
      if (searchable && searchable.includes(hint) && !seen.has(node.id)) {
        results.push(node);
        seen.add(node.id);
        break;
      }
    }
    if ('children' in node) {
      for (const child of node.children) walk(child);
    }
  };
  const frame = getSelectedFrame();
  if (frame) walk(frame);
  return results;
}

function inspectNodeIds(nodeIds: string[], fallbackHints: string[]) {
  // 主路径:精确 id 匹配
  const nodes: SceneNode[] = [];
  for (const id of nodeIds) {
    const n = figma.getNodeById(id);
    if (n && 'type' in n && n.type !== 'PAGE' && n.type !== 'DOCUMENT') {
      nodes.push(n as SceneNode);
    }
  }

  // Fallback:精确 id 全部失败 · 且有 hints · fuzzy 匹配
  let usedFallback = false;
  if (nodes.length === 0 && fallbackHints.length > 0) {
    const fuzzy = findNodesByHint(fallbackHints);
    if (fuzzy.length > 0) {
      nodes.push(...fuzzy);
      usedFallback = true;
    }
  }

  if (nodes.length === 0) {
    // 最终兜底:定位到 Frame
    const frame = getSelectedFrame();
    if (frame) {
      figma.currentPage.selection = [frame];
      figma.viewport.scrollAndZoomIntoView([frame]);
    }
    figma.ui.postMessage({
      type: 'INSPECT_RESULT',
      matched: 0,
      usedFallback: false,
      fellBackToFrame: true,
    });
    return;
  }

  figma.currentPage.selection = nodes;
  figma.viewport.scrollAndZoomIntoView(nodes);
  figma.ui.postMessage({
    type: 'INSPECT_RESULT',
    matched: nodes.length,
    usedFallback,
    fellBackToFrame: false,
  });
}

void sendSelectionState();

figma.on('selectionchange', () => {
  void sendSelectionState();
});

figma.ui.onmessage = (msg: {
  type: string;
  nodeIds?: string[];
  fallbackHints?: string[];
}) => {
  if (msg.type === 'REQUEST_EXPORT') {
    void exportFullFrame();
  } else if (msg.type === 'INSPECT_NODES') {
    inspectNodeIds(msg.nodeIds ?? [], msg.fallbackHints ?? []);
  } else if (msg.type === 'CLOSE') {
    figma.closePlugin();
  }
};
