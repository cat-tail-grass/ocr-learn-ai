<script setup>
import ThemeLayout from '@vuepress/theme-default/layouts/Layout.vue';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { onContentUpdated, RouteLink, usePageData, withBase } from 'vuepress/client';
import CourseToc from './CourseToc.vue';
import '../styles/course.css';

const page = usePageData();
const course = computed(() => page.value.course ?? null);
const isCatalogPage = computed(() => Boolean(page.value.courseStages?.length));
const domHeadings = ref([]);
const activeSlug = ref('');
const progress = ref(0);
const inlineTocOpen = ref(false);
const copyLabel = ref('复制命令');
const copyMessage = ref('');
let contentElement;
let headingElements = [];
let frame = 0;
let copyTimer;
let resizeObserver;

function flattenHeadings(headers) {
  const result = [];
  const visit = (items) => {
    for (const item of items) {
      if ((item.level === 2 || item.level === 3) && item.slug) {
        result.push({ level: item.level, slug: item.slug, title: item.title });
      }
      if (item.children?.length) visit(item.children);
    }
  };
  visit(headers);
  return result;
}

const headings = computed(() => {
  const metadataHeadings = flattenHeadings(page.value.headers ?? []);
  return metadataHeadings.length ? metadataHeadings : domHeadings.value;
});
const activeTitle = computed(() => headings.value.find((heading) => heading.slug === activeSlug.value)?.title ?? '章首');

function updateReadingPosition() {
  frame = 0;
  if (!course.value || !contentElement?.isConnected) return;
  const navbarHeight = document.querySelector('.vp-navbar')?.getBoundingClientRect().height ?? 0;
  const readingBarHeight = document.querySelector('.course-reading-bar')?.getBoundingClientRect().height ?? 0;
  const offset = navbarHeight + readingBarHeight + 24;
  const contentRect = contentElement.getBoundingClientRect();
  const contentTop = contentRect.top + window.scrollY;
  const availableDistance = Math.max(1, contentRect.height - window.innerHeight + offset);
  progress.value = Math.round(Math.min(100, Math.max(0, ((window.scrollY + offset - contentTop) / availableDistance) * 100)));

  let currentSlug = '';
  for (const heading of headingElements) {
    if (heading.getBoundingClientRect().top <= offset + 12) currentSlug = heading.id;
    else break;
  }
  activeSlug.value = currentSlug;
}

function scheduleReadingPosition() {
  if (!frame) frame = window.requestAnimationFrame(updateReadingPosition);
}

async function refreshContent() {
  await nextTick();
  resizeObserver?.disconnect();
  contentElement = course.value ? document.getElementById('content') : undefined;
  headingElements = contentElement ? [...contentElement.querySelectorAll('h2[id], h3[id]')] : [];
  domHeadings.value = headingElements.map((heading) => {
    const label = heading.cloneNode(true);
    label.querySelectorAll('.header-anchor').forEach((anchor) => anchor.remove());
    return { level: Number(heading.tagName.slice(1)), slug: heading.id, title: label.textContent.trim() };
  });
  if (contentElement) resizeObserver?.observe(contentElement);
  scheduleReadingPosition();
}

function copyWithSelection(command) {
  const previousFocus = document.activeElement;
  const selection = document.getSelection();
  const ranges = selection ? Array.from({ length: selection.rangeCount }, (_, index) => selection.getRangeAt(index)) : [];
  const input = document.createElement('textarea');
  input.value = command;
  input.setAttribute('readonly', '');
  input.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;';
  document.body.append(input);
  input.select();
  try {
    if (!document.execCommand('copy')) throw new Error('copy unavailable');
  } finally {
    input.remove();
    selection?.removeAllRanges();
    ranges.forEach((range) => selection?.addRange(range));
    previousFocus?.focus?.({ preventScroll: true });
  }
}

async function copyCommand() {
  const command = course.value?.nodeCommand;
  if (!command) return;
  clearTimeout(copyTimer);
  try {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(command);
    } catch {
      copyWithSelection(command);
    }
    if (course.value?.nodeCommand !== command) return;
    copyLabel.value = '已复制';
    copyMessage.value = '运行命令已复制，请在项目根目录执行。';
  } catch {
    copyMessage.value = '复制未成功，可选中命令手动复制。';
  }
  copyTimer = setTimeout(() => { copyLabel.value = '复制命令'; }, 2500);
}

watch(() => page.value.path, () => {
  activeSlug.value = '';
  progress.value = 0;
  domHeadings.value = [];
  inlineTocOpen.value = false;
  copyLabel.value = '复制命令';
  copyMessage.value = '';
  clearTimeout(copyTimer);
});

watch(activeSlug, async () => {
  await nextTick();
  const activeLink = document.querySelector('.course-toc-rail [aria-current="location"]');
  const toc = activeLink?.closest('.course-toc-nav');
  if (!toc || !activeLink || !toc.clientHeight) return;
  const linkRect = activeLink.getBoundingClientRect();
  const tocRect = toc.getBoundingClientRect();
  if (linkRect.top < tocRect.top) toc.scrollTop -= tocRect.top - linkRect.top + 12;
  else if (linkRect.bottom > tocRect.bottom) toc.scrollTop += linkRect.bottom - tocRect.bottom + 12;
});

onContentUpdated((reason) => {
  if (reason !== 'beforeUnmount') void refreshContent();
});

onMounted(() => {
  if (typeof ResizeObserver !== 'undefined') resizeObserver = new ResizeObserver(scheduleReadingPosition);
  window.addEventListener('scroll', scheduleReadingPosition, { passive: true });
  window.addEventListener('resize', scheduleReadingPosition, { passive: true });
  window.addEventListener('hashchange', scheduleReadingPosition);
  void refreshContent();
});

onBeforeUnmount(() => {
  window.removeEventListener('scroll', scheduleReadingPosition);
  window.removeEventListener('resize', scheduleReadingPosition);
  window.removeEventListener('hashchange', scheduleReadingPosition);
  window.cancelAnimationFrame(frame);
  clearTimeout(copyTimer);
  resizeObserver?.disconnect();
});
</script>

<template>
  <ThemeLayout :class="{ 'course-layout': course, 'course-home': isCatalogPage }">
    <template #sidebar-top>
      <div class="course-sidebar-intro">
        <RouteLink to="/#course-catalog">课程学习路径 <span aria-hidden="true">↗</span></RouteLink>
        <p v-if="course">正在阅读 <strong>第 {{ course.id }} 章</strong><br>{{ course.stage }}</p>
        <p v-else>按阶段选择讲义与实验</p>
      </div>
    </template>

    <template #page-top>
      <div v-if="course" class="course-reading-bar" aria-label="本章阅读位置">
        <div class="course-reading-location">
          <span class="course-reading-chapter">第 {{ course.id }} 章</span>
          <span class="course-reading-title" :title="activeTitle">{{ activeTitle }}</span>
        </div>
        <a v-if="headings.length" class="course-reading-toc-link" href="#course-chapter-toc" @click="inlineTocOpen = true">本章目录</a>
        <span class="course-reading-percent" aria-hidden="true">{{ progress }}%</span>
        <progress class="course-reading-progress" max="100" :value="progress" aria-label="本章阅读进度">{{ progress }}%</progress>
      </div>

      <aside v-if="course && headings.length" class="course-toc-rail" aria-labelledby="course-toc-rail-title">
        <p id="course-toc-rail-title" class="course-toc-title">本章目录</p>
        <CourseToc :headings="headings" :active-slug="activeSlug" />
        <a class="course-back-to-start" href="#course-chapter-start">回到章首 <span aria-hidden="true">↑</span></a>
      </aside>
    </template>

    <template #page-content-top>
      <header v-if="course" id="course-chapter-start" class="course-chapter-header" aria-label="本章学习入口">
        <div class="course-chapter-context">
          <RouteLink to="/#course-catalog">课程目录</RouteLink>
          <span aria-hidden="true">/</span>
          <span>阶段 {{ course.stageIndex }} · {{ course.stage }}</span>
          <span class="course-chapter-tag">第 {{ course.id }} 章</span>
        </div>
        <div class="course-chapter-actions">
          <a
            class="course-lab-button"
            :href="withBase(course.labPath)"
            target="_blank"
            rel="noopener noreferrer"
            :aria-label="`打开第 ${course.id} 章交互实验（新标签页）`"
          >打开本章交互实验 <span aria-hidden="true">↗</span></a>
          <span class="course-lab-note">在新标签页中练习，保留阅读位置</span>
        </div>
        <div class="course-node-command">
          <span class="course-command-label">本地运行</span>
          <code tabindex="0">{{ course.nodeCommand }}</code>
          <button type="button" @click="copyCommand">{{ copyLabel }}</button>
        </div>
        <p class="course-command-help">在项目根目录执行。<span role="status" aria-live="polite">{{ copyMessage }}</span></p>
      </header>

      <details
        v-if="course && headings.length"
        id="course-chapter-toc"
        class="course-toc-inline"
        :open="inlineTocOpen"
        @toggle="inlineTocOpen = $event.target.open"
      >
        <summary><span>本章目录</span><span class="course-toc-count">{{ headings.length }} 个小节</span></summary>
        <CourseToc :headings="headings" :active-slug="activeSlug" />
      </details>
    </template>
  </ThemeLayout>
</template>
