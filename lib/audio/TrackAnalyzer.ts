export function computePeaks(buffer: AudioBuffer, peakCount = 1024) {
  const channelData = buffer.numberOfChannels > 0 ? buffer.getChannelData(0) : new Float32Array(0);
  const blockSize = Math.floor(channelData.length / peakCount) || 1;
  const peaks = new Float32Array(peakCount);
  for (let i = 0; i < peakCount; i++) {
    const start = i * blockSize;
    const end = Math.min(start + blockSize, channelData.length);
    let max = 0;
    for (let j = start; j < end; j++) {
      const v = Math.abs(channelData[j]);
      if (v > max) max = v;
    }
    peaks[i] = max;
  }
  return peaks;
}

export function computeRMS(buffer: AudioBuffer) {
  let sum = 0;
  let count = 0;
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < data.length; i++) {
      const v = data[i];
      sum += v * v;
      count++;
    }
  }
  const rms = Math.sqrt(sum / Math.max(1, count));
  return rms;
}
