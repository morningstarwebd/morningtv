// src/utils/audioBooster.ts
// Web Audio API engine providing up to 300% volume amplification with anti-clipping dynamics compression

class AudioBoosterManager {
	private audioCtx: AudioContext | null = null;
	private sourceNode: MediaElementAudioSourceNode | null = null;
	private gainNode: GainNode | null = null;
	private compressorNode: DynamicsCompressorNode | null = null;
	private connectedElement: HTMLVideoElement | null = null;
	private isNormalized: boolean = false;

	public attach(video: HTMLVideoElement, boostPercent: number = 100): void {
		if (this.connectedElement === video && this.gainNode) {
			this.setBoost(boostPercent);
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

			this.setBoost(boostPercent);
		} catch (err) {
			console.warn(
				"Web Audio API Booster initialization skipped or already connected:",
				err,
			);
		}
	}

	public setBoost(percent: number): void {
		if (!this.gainNode || !this.audioCtx) return;
		// Map 0-300% to 0.0 - 3.0 gain factor
		const targetGain = Math.max(0, Math.min(300, percent)) / 100;
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
