// src/utils/audioBooster.ts
// Web Audio API engine providing up to 300% volume amplification with anti-clipping dynamics compression

class AudioBoosterManager {
	private audioCtx: AudioContext | null = null;
	private sourceNode: MediaElementAudioSourceNode | null = null;
	private gainNode: GainNode | null = null;
	private compressorNode: DynamicsCompressorNode | null = null;
	private connectedElement: HTMLVideoElement | null = null;
	private isNormalized: boolean = false;
	private volumePercent: number = 85;
	private boostPercent: number = 100;
	private isMuted: boolean = false;

	public attach(
		video: HTMLVideoElement,
		volumePercent: number = 85,
		boostPercent: number = 100,
		isMuted: boolean = false,
	): void {
		this.volumePercent = volumePercent;
		this.boostPercent = boostPercent;
		this.isMuted = isMuted;

		if (this.connectedElement === video && this.gainNode) {
			this.updateGain();
			return;
		}

		try {
			const AudioContextClass =
				window.AudioContext ||
				(window as unknown as { webkitAudioContext: typeof AudioContext })
					.webkitAudioContext;
			if (!AudioContextClass) return;

			if (!this.audioCtx || this.audioCtx.state === "closed") {
				this.audioCtx = new AudioContextClass();
			}

			if (this.audioCtx.state === "suspended") {
				this.audioCtx.resume().catch(() => {});
			}

			if (this.connectedElement !== video) {
				if (this.sourceNode) {
					try {
						this.sourceNode.disconnect();
					} catch {
						// Ignored
					}
				}

				this.sourceNode = this.audioCtx.createMediaElementSource(video);
				this.gainNode = this.audioCtx.createGain();
				this.compressorNode = this.audioCtx.createDynamicsCompressor();

				// Dynamics compressor settings to prevent harsh clipping / distortion above 100%
				this.compressorNode.threshold.setValueAtTime(
					-18,
					this.audioCtx.currentTime,
				);
				this.compressorNode.knee.setValueAtTime(12, this.audioCtx.currentTime);
				this.compressorNode.ratio.setValueAtTime(4, this.audioCtx.currentTime);
				this.compressorNode.attack.setValueAtTime(
					0.003,
					this.audioCtx.currentTime,
				);
				this.compressorNode.release.setValueAtTime(
					0.25,
					this.audioCtx.currentTime,
				);

				// Chain: Video Source -> Gain (Pre-Amp Boost) -> Compressor (Anti-distortion) -> Audio Output
				this.sourceNode.connect(this.gainNode);
				this.gainNode.connect(this.compressorNode);
				this.compressorNode.connect(this.audioCtx.destination);

				this.connectedElement = video;
			}

			this.updateGain();
		} catch (err) {
			console.warn(
				"Web Audio API Booster initialization skipped or already connected:",
				err,
			);
		}
	}

	public setVolume(volume: number): void {
		this.volumePercent = Math.max(0, Math.min(100, volume));
		if (this.volumePercent === 0) {
			this.isMuted = true;
		}
		this.updateGain();
	}

	public setBoost(percent: number): void {
		this.boostPercent = Math.max(100, Math.min(300, percent));
		this.updateGain();
	}

	public setMuted(muted: boolean): void {
		this.isMuted = muted;
		this.updateGain();
	}

	private updateGain(): void {
		const normVolume = this.isMuted
			? 0
			: Math.max(0, Math.min(100, this.volumePercent)) / 100;
		const normBoost = Math.max(100, Math.min(300, this.boostPercent)) / 100;
		const targetGain = normVolume * normBoost;

		if (this.connectedElement) {
			try {
				this.connectedElement.volume = normVolume;
			} catch {
				// Ignored
			}
		}

		if (this.gainNode && this.audioCtx) {
			try {
				this.gainNode.gain.setTargetAtTime(
					targetGain,
					this.audioCtx.currentTime,
					0.02,
				);
			} catch {
				this.gainNode.gain.value = targetGain;
			}
		}
	}

	public resume(): void {
		if (this.audioCtx && this.audioCtx.state === "suspended") {
			this.audioCtx.resume().catch(() => {});
		}
	}

	public setNormalize(enabled: boolean): void {
		this.isNormalized = enabled;
		if (!this.compressorNode || !this.audioCtx) return;
		try {
			const now = this.audioCtx.currentTime;
			if (enabled) {
				// Broadcast normalization: smooth out channel loudness variations (-12 dB, 4.5:1 ratio)
				this.compressorNode.threshold.setTargetAtTime(-12, now, 0.05);
				this.compressorNode.knee.setTargetAtTime(8, now, 0.05);
				this.compressorNode.ratio.setTargetAtTime(4.5, now, 0.05);
				this.compressorNode.attack.setTargetAtTime(0.003, now, 0.05);
				this.compressorNode.release.setTargetAtTime(0.2, now, 0.05);
			} else {
				// Default anti-distortion limiting settings
				this.compressorNode.threshold.setTargetAtTime(-18, now, 0.05);
				this.compressorNode.knee.setTargetAtTime(12, now, 0.05);
				this.compressorNode.ratio.setTargetAtTime(4, now, 0.05);
				this.compressorNode.attack.setTargetAtTime(0.003, now, 0.05);
				this.compressorNode.release.setTargetAtTime(0.25, now, 0.05);
			}
		} catch {
			// Ignored
		}
	}

	public getNormalize(): boolean {
		return this.isNormalized;
	}

	public detach(): void {
		if (this.sourceNode) {
			try {
				this.sourceNode.disconnect();
			} catch {
				// Ignored
			}
			this.sourceNode = null;
		}
		this.connectedElement = null;
	}
}

export const audioBooster = new AudioBoosterManager();
