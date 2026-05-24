/* ─── 公共脚本：导航、Tab 切换等 ─── */

document.addEventListener("DOMContentLoaded", () => {
  // 移动端导航切换
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".site-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      nav.classList.toggle("open");
    });
    // 点击导航链接后关闭菜单
    nav.querySelectorAll("a").forEach(link => {
      link.addEventListener("click", () => {
        nav.classList.remove("open");
      });
    });
  }

  // Tab 切换
  document.querySelectorAll(".tabs").forEach((tabBar) => {
    const buttons = tabBar.querySelectorAll(".tab-btn");
    const containerId = tabBar.dataset.tabContainer;
    const container = containerId
      ? document.getElementById(containerId)
      : tabBar.nextElementSibling;

    if (!container) return;
    const panels = container.querySelectorAll(".tab-panel");

    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        buttons.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");

        const target = btn.dataset.tab;
        panels.forEach((p) => {
          p.style.display = p.id === target ? "" : "none";
        });
      });
    });

    // 初始化：只显示第一个
    panels.forEach((p, i) => {
      p.style.display = i === 0 ? "" : "none";
    });
  });

  // 高亮当前页面导航
  const currentPage = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".site-nav a").forEach((a) => {
    const href = a.getAttribute("href");
    if (href && href.split("/").pop() === currentPage) {
      a.classList.add("active");
    }
  });
});
