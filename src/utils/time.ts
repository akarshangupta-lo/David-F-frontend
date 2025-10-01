export const TIME_PER_IMAGE_SECONDS = 15;

export const formatTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return minutes > 0 ? `${minutes} min ${remainingSeconds} sec` : `${seconds} sec`;
};