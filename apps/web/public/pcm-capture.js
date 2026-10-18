// Mono PCM is buffered only in this browser until the user finishes the bounded recording.
class DenlumiCapture extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0]?.[0];
    if (channel) this.port.postMessage(channel.slice());
    return true;
  }
}
registerProcessor('denlumi-capture', DenlumiCapture);
