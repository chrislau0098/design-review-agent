// Figma sandbox 侧 · runs inside Figma plugin's JS sandbox
// 只可用 figma.* API + postMessage · 无 DOM · 无 fetch

const UI_WIDTH = 340;
const UI_HEIGHT = 560;

figma.showUI(__html__, { width: UI_WIDTH, height: UI_HEIGHT, themeColors: true });

type SelectableNode = SceneNode & { exportAsync: FrameNode['exportAsync'] };

// 判断是否是能 export 的节点(Frame / Component / Instance / Group)
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
  // Figma sandbox 里 btoa 可用 · 但 Uint8Array 要转 binary string
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(binary);
}

async function sendSelectionState() {
  const frame = getSelectedFrame();
  if (!frame) {
    figma.ui.postMessage({ type: 'NO_SELECTION' });
    return;
  }
  // 缩略图 · 尽量小(避免 UI 端渲染慢)· scale 0.3-0.5 for thumbnail
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
    // 缩略图失败不阻塞 · 主流程仍可跑
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
    // 2x scale for review · 与执行计划一致
    // 大 Frame 时降级到 1x 避免 base64 > 4.5MB
    let scale = 2;
    if (Math.max(frame.width, frame.height) > 2000) scale = 1;

    const bytes = await frame.exportAsync({
      format: 'PNG',
      constraint: { type: 'SCALE', value: scale },
    });
    const imageBase64 = toBase64(bytes);
    figma.ui.postMessage({ type: 'FRAME_EXPORTED', imageBase64 });
  } catch (e) {
    figma.ui.postMessage({
      type: 'EXPORT_FAILED',
      message: e instanceof Error ? e.message : String(e),
    });
  }
}

// 首次启动 · 立刻推 selection 状态
void sendSelectionState();

// 监听 selection 变化
figma.on('selectionchange', () => {
  void sendSelectionState();
});

// 接收 UI 消息
figma.ui.onmessage = (msg: { type: string }) => {
  if (msg.type === 'REQUEST_EXPORT') {
    void exportFullFrame();
  } else if (msg.type === 'CLOSE') {
    figma.closePlugin();
  }
};
