// Figma sandbox 侧 · runs inside Figma plugin's JS sandbox
// 只可用 figma.* API + postMessage · 无 DOM · 无 fetch

const UI_WIDTH = 400;
const UI_HEIGHT = 720;
const MAX_STRUCTURE_NODES = 150;
const HISTORY_KEY = 'review_history_v1';

figma.showUI(__html__, { width: UI_WIDTH, height: UI_HEIGHT, themeColors: true });

type SelectableNode = SceneNode & { exportAsync: FrameNode['exportAsync'] };

interface OutStructureNode {
  id: string;
  name: string;
  type: string;
  characters?: string;
  bbox: [number, number, number, number];
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
      const area = nw * nh;
      const relevant =
        area >= 0.001 &&
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
    if ('children' in node) {
      for (const child of node.children) walk(child);
    }
  };

  walk(root);
  collected.sort((a, b) => b.area - a.area);
  return collected.slice(0, MAX_STRUCTURE_NODES).map((n) => {
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

// Bug 1 修复:Inspect 会触发 selectionchange · 我们 sendSelectionState 会切覆盖 UI
// 加时间锁 · Inspect 触发后 800ms 内的 selectionchange 忽略(足够 scrollAndZoomIntoView 稳定)
let muteSelectionChangeUntil = 0;

function inspectNodeIds(nodeIds: string[], fallbackHints: string[]) {
  const nodes: SceneNode[] = [];
  for (const id of nodeIds) {
    const n = figma.getNodeById(id);
    if (n && 'type' in n && n.type !== 'PAGE' && n.type !== 'DOCUMENT') {
      nodes.push(n as SceneNode);
    }
  }

  let usedFallback = false;
  if (nodes.length === 0 && fallbackHints.length > 0) {
    const fuzzy = findNodesByHint(fallbackHints);
    if (fuzzy.length > 0) {
      nodes.push(...fuzzy);
      usedFallback = true;
    }
  }

  // Bug 1 · 关键修复:执行选中前 · mute selectionchange
  muteSelectionChangeUntil = Date.now() + 800;

  if (nodes.length === 0) {
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

async function loadHistory() {
  const list = ((await figma.clientStorage.getAsync(HISTORY_KEY)) ?? []) as unknown;
  figma.ui.postMessage({
    type: 'HISTORY_LOADED',
    entries: Array.isArray(list) ? list : [],
  });
}

async function saveHistory(entries: unknown) {
  try {
    await figma.clientStorage.setAsync(HISTORY_KEY, entries);
    figma.ui.postMessage({ type: 'HISTORY_SAVED' });
  } catch (e) {
    figma.ui.postMessage({
      type: 'HISTORY_SAVE_FAILED',
      message: e instanceof Error ? e.message : String(e),
    });
  }
}

void sendSelectionState();
void loadHistory();

figma.on('selectionchange', () => {
  // Inspect race guard · 短时间内 skip
  if (Date.now() < muteSelectionChangeUntil) return;
  void sendSelectionState();
});

figma.ui.onmessage = (msg: {
  type: string;
  nodeIds?: string[];
  fallbackHints?: string[];
  url?: string;
  entries?: unknown;
}) => {
  if (msg.type === 'REQUEST_EXPORT') {
    void exportFullFrame();
  } else if (msg.type === 'INSPECT_NODES') {
    inspectNodeIds(msg.nodeIds ?? [], msg.fallbackHints ?? []);
  } else if (msg.type === 'OPEN_URL' && msg.url) {
    // 白名单外的 URL 不打开(不用担心 XSS · Doubao 输出的 URL 我们不接受 · principle-links 白名单)
    // 这里再做一次白名单校验
    const allowed = /^https:\/\/(?:www\.)?(w3\.org|wikipedia\.org|nngroup\.com|m3\.material\.io|developer\.apple\.com|refactoringui\.com)\//;
    if (allowed.test(msg.url)) {
      figma.openExternal(msg.url);
    }
  } else if (msg.type === 'LOAD_HISTORY') {
    void loadHistory();
  } else if (msg.type === 'SAVE_HISTORY') {
    void saveHistory(msg.entries);
  } else if (msg.type === 'CLOSE') {
    figma.closePlugin();
  }
};
