import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Sunny Side Stories game shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="zh-CN">/i);
  assert.match(html, /<title>晴天生活｜原创生活模拟游戏<\/title>/);
  assert.match(html, /<main class="game-shell/);
  assert.match(html, /class="world3d"[^>]*data-render-state="loading"[^>]*data-scene-mode="3d"/);
  assert.match(html, /class="world3d-poster" role="status"/);
  assert.match(html, /正在进入晴天市/);
  assert.match(html, /aria-label="自动环境状态"/);
  assert.match(html, /aria-label="游戏功能"/);
  assert.match(html, /任务/);
  assert.match(html, /背包/);
  assert.match(html, /拍照/);
  assert.match(html, /存档/);
});

test("keeps the real-time game, life systems and loading fallback connected", async () => {
  const [page, world, lifeUi, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/World3D.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/LifeSystemUI.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /<World3D[\s\S]*timeOfDay=\{timeOfDay\}[\s\S]*weatherMode=\{weatherMode\}/);
  assert.match(page, /<LifeSystemUI/);
  assert.match(page, /automaticWeather/);
  assert.match(world, /groundCharacterToPlane/);
  assert.match(world, /data-render-state=\{renderState\}/);
  assert.match(world, /v4-loading\.webp/);
  assert.match(world, /WASD \/ 方向键移动/);
  assert.match(lifeUi, /任务与小事件/);
  assert.match(lifeUi, /背包/);
  assert.match(lifeUi, /地图与标记/);
  assert.match(layout, /title:\s*"晴天生活｜原创生活模拟游戏"/);
  assert.match(packageJson, /"three":/);

  await assert.rejects(access(new URL("../app/_sites-preview/SkeletonPreview.tsx", import.meta.url)));
});
