import { appId } from '@/storage';
import { StorageSerializers, useStorageAsync } from '@vueuse/core';
import { defu } from 'defu';

/** 创建一个具有本地存储配置的 tts 发声函数 */
export function useTTS(options?: { storageKey?: string; lang?: string; rate?: number }) {
  const op = defu(options, { storageKey: appId + 'ttsConfig_v0', lang: 'en-US', rate: 0.7 });
  const ttsConfig = useStorageAsync<{
    lang: string;
    rate: number;
  }>(op.storageKey, { lang: op.lang, rate: op.rate }, undefined, {
    serializer: StorageSerializers.object,
  });

  /** 文本转语音 */
  function speakText(text: string, opitons?: { lang?: string; rate?: number }) {
    const op = defu(opitons, ttsConfig.value);
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = op.lang;
      utterance.rate = op.rate;
      speechSynthesis.speak(utterance);
    } else {
      console.error('Speech synthesis is not supported in this browser.');
    }
  }

  return {
    ttsConfig,
    speakText,
  };
}
