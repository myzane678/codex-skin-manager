import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

const examples = [
  {
    label: '留白构图',
    prompt: '16:9 编程工作区桌面背景，电影感柔和风景，视觉主体放在最右侧，左侧和中间保留平静、低细节的大面积留白，低饱和、低对比度、柔和层次；不要文字、不要徽标、不要 UI、不要界面截图。',
  },
  {
    label: '抽象纹理',
    prompt: '16:9 编程工作区抽象背景，大面积柔和几何形状与轻微纸张纹理，左侧和中间保留安静的低细节安全区，低对比度、克制配色、漫射光；不要文字、不要徽标、不要 UI、不要界面截图。',
  },
  {
    label: '自然场景',
    prompt: '16:9 编程工作区自然背景，薄雾森林山谷与清晨光线，远处焦点位于最右侧，前景柔和虚化，左侧和中间保留大面积低细节空间，低饱和色调；不要人物、不要文字、不要徽标、不要 UI。',
  },
  {
    label: '建筑场景',
    prompt: '16:9 编程工作区建筑背景，极简现代室内与柔和窗光，建筑结构集中在最右侧，左侧和中间保留干净、低细节的墙面空间，低对比度；不要人物、不要文字、不要徽标、不要 UI。',
  },
] as const;

export function ImagePromptExamples() {
  const [copied, setCopied] = useState<string | null>(null);

  async function copyPrompt(label: string, prompt: string): Promise<void> {
    await navigator.clipboard.writeText(prompt);
    setCopied(label);
    window.setTimeout(() => setCopied((current) => current === label ? null : current), 1_600);
  }

  return (
    <aside className="image-prompt-examples" aria-labelledby="prompt-examples-title">
      <div className="prompt-examples-heading">
        <p className="eyebrow">IMAGE PROMPTS</p>
        <h2 id="prompt-examples-title">生图提示词范例</h2>
      </div>
      <div className="prompt-example-list">
        {examples.map((example) => (
          <div className="prompt-example" key={example.label}>
            <strong>{example.label}</strong>
            <p>{example.prompt}</p>
            <button
              className="icon-action"
              title={`复制${example.label}提示词`}
              aria-label={`复制${example.label}提示词`}
              onClick={() => void copyPrompt(example.label, example.prompt)}
            >
              {copied === example.label ? <Check size={16} /> : <Copy size={16} />}
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
}
