<script setup>
defineProps({
  headings: { type: Array, default: () => [] },
  activeSlug: { type: String, default: '' },
});
</script>

<template>
  <nav class="course-toc-nav" aria-label="本章小节">
    <ol class="course-toc-list">
      <li
        v-for="heading in headings"
        :key="heading.slug"
        :class="{ 'course-toc-subsection': heading.level === 3 }"
      >
        <a
          :href="`#${encodeURIComponent(heading.slug)}`"
          :aria-current="activeSlug === heading.slug ? 'location' : undefined"
        >{{ heading.title }}</a>
      </li>
    </ol>
  </nav>
</template>
