<script setup lang="ts">
const model = defineModel<string>({ required: true })

const isValidHex = (v: string) => /^#[0-9a-fA-F]{6}$/.test(v)

function onTextInput(v: string | number) {
  const s = String(v).trim()
  if (/^[0-9a-fA-F]{6}$/.test(s)) {
    model.value = `#${s}`
    return
  }
  if (isValidHex(s)) {
    model.value = s
    return
  }
  model.value = s
}

const swatchColor = computed(() => (isValidHex(model.value) ? model.value : '#cccccc'))
const hasError = computed(() => model.value.length > 0 && !isValidHex(model.value))
</script>

<template>
  <div class="space-y-1">
    <div class="flex items-center gap-2">
      <label
        class="relative size-9 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-slate-200 shadow-sm transition hover:shadow-md dark:border-slate-600"
      >
        <input
          type="color"
          :value="swatchColor"
          class="absolute inset-0 size-full cursor-pointer opacity-0"
          @input="model = ($event.target as HTMLInputElement).value"
        />
        <span
          class="block size-full rounded-lg"
          :style="{ backgroundColor: swatchColor }"
        />
      </label>
      <UInput
        :model-value="model"
        class="flex-1 font-mono text-xs"
        size="sm"
        placeholder="#000000"
        @update:model-value="onTextInput"
      />
    </div>
    <div v-if="hasError" class="text-xs text-red-500 dark:text-red-400">
      Use format #RRGGBB
    </div>
  </div>
</template>
