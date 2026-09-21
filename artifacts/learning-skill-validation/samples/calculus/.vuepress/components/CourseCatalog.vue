<script setup>
import { computed } from 'vue';
import { RouteLink, usePageData, withBase } from 'vuepress/client';
const page = usePageData();
const stages = computed(() => page.value.courseStages || []);
const chapterCount = computed(() => page.value.courseCatalog?.length || 0);
const readyCount = computed(() => (page.value.courseCatalog || []).filter(chapter => chapter.available).length);
const stageNumber = id => String(id).padStart(2, '0');
</script>

<template>
  <section id="course-catalog" class="course-catalog" aria-labelledby="course-catalog-title">
    <div class="course-catalog-heading">
      <p class="course-eyebrow">完整学习路径</p>
      <h2 id="course-catalog-title">{{ stages.length }} 个阶段，{{ chapterCount }} 章循序学习</h2>
      <p class="course-catalog-description">{{ page.courseDescription }}</p>
      <p>{{ readyCount }} 章可阅读 · 其余章节按路线逐步准备</p>
    </div>
    <nav class="course-stage-shortcuts" aria-label="按学习阶段定位">
      <a v-for="stage in stages" :key="stage.id" :href="`#course-stage-${stage.id}`"><span>{{ stageNumber(stage.id) }}</span>{{ stage.title }}</a>
    </nav>
    <div class="course-stage-grid">
      <section v-for="stage in stages" :id="`course-stage-${stage.id}`" :key="stage.id" class="course-stage" :aria-labelledby="`course-stage-title-${stage.id}`">
        <header class="course-stage-heading">
          <span class="course-stage-number" aria-hidden="true">{{ stageNumber(stage.id) }}</span>
          <div><h3 :id="`course-stage-title-${stage.id}`">{{ stage.title }}</h3><p>{{ stage.chapters.length }} 节课程</p></div>
        </header>
        <ol class="course-chapter-list" :start="Number(stage.chapters[0].id)">
          <li v-for="chapter in stage.chapters" :key="chapter.slug">
            <RouteLink v-if="chapter.available" :to="chapter.docPath" class="course-chapter-link"><span class="course-chapter-number" aria-hidden="true">{{ chapter.id }}</span><span>{{ chapter.shortTitle }}</span></RouteLink>
            <span v-else class="course-chapter-link course-planned"><span class="course-chapter-number">{{ chapter.id }}</span><span>{{ chapter.shortTitle }}</span><small>待准备</small></span>
            <a v-if="chapter.labPath" :href="withBase(chapter.labPath)" class="course-catalog-lab" target="_blank" rel="noopener noreferrer" :aria-label="`打开第 ${chapter.id} 章交互实验（新标签页）`">练习 ↗</a>
          </li>
        </ol>
      </section>
    </div>
  </section>
</template>

<style scoped>
.course-planned { opacity: .64; }
.course-planned small { font-size: .72rem; white-space: nowrap; margin-left: auto; }
</style>
