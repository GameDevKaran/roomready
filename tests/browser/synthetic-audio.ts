import type {Page} from '@playwright/test';
/** Explicit browser input double: real Web Audio sine stream, no physical microphone. */
export async function installSyntheticAudio(page:Page){await page.addInitScript(()=>{
 navigator.mediaDevices.getUserMedia=async()=>{
  const ctx=new AudioContext();await ctx.resume();const source=ctx.createOscillator(),volume=ctx.createGain(),dest=ctx.createMediaStreamDestination();
  source.frequency.value=440;volume.gain.value=.15;source.connect(volume).connect(dest);source.start();
  const track=dest.stream.getAudioTracks()[0],stop=track.stop.bind(track);Object.defineProperty(track,'label',{value:'SYNTHETIC AUDIO — test double'});track.stop=()=>{stop();source.stop();void ctx.close();};
  return dest.stream;
 };
 navigator.mediaDevices.enumerateDevices=async()=>[];
 });}
