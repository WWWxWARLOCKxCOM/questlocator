import { httpsCallable } from 'firebase/functions';
import { functions } from '@/config/firebase';

export async function submitQuestTask(input: {
  sessionId: string;
  taskId: string;
  answerText?: string;
  answerPhotoPath?: string;
  answerAnswers?: { questionId: string; answer: string }[];
}) {
  const fn = httpsCallable<
    typeof input,
    { ok: boolean; count: number; repeat: number }
  >(functions, 'submitQuestTask');
  return (await fn(input)).data;
}

export async function getTaskCompletions(placeId: string) {
  const fn = httpsCallable<
    { placeId: string },
    { ok: boolean; completions: Record<string, number> }
  >(functions, 'getTaskCompletions');
  return (await fn({ placeId })).data;
}