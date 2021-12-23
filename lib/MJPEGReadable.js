import { Readable } from 'stream';
import { spawn } from 'child_process';
import pathToFfmpeg from 'ffmpeg-static';

export class RestartingError extends Error {}

export const ILLEGAL_CHARS = /[^A-Za-z0-9-_ ]/;

export default class MJPEGReadable extends Readable {
	#name = null;
	#captureInterval = null;
	#ffmpeg = null;
	#ffmpegInputArgs = [];
	#buffs = [];
	#restarting = false;

	constructor(name, captureInterval) {
		super();

		
		this.name = name;
		this.captureInterval = captureInterval;
		this.#ffmpegInputArgs = ['-f', 'lavfi', '-i', 'smptebars'];
	}
	_construct(callback) {
		this.start();

		callback();
	}
	start() {
		this.#ffmpeg = spawn(pathToFfmpeg, [
			'-hide_banner',
			'-loglevel', 'error',
			// '-ss', '1',
			...this.#ffmpegInputArgs,
			'-c:v', 'mjpeg',
			'-q:v', '4',
			'-r', `1/${this.#captureInterval}`,
			'-f', 'mpjpeg',
			'-an',
			'-'
		]);
		this.#ffmpeg.stdout.on('data', data => {
			this.#buffs.push(data);
		});
		this.#ffmpeg.stderr.on('data', data => {
			// console.log(`stderr: ${data}`);
		});
		this.#ffmpeg.on('close', code => {
			if(code !== 0)
				this.destroy(new Error(`Exited with error code: ${code}`));
			this.#ffmpeg = null;
			if(this.#restarting) {
				this.#restarting = false;
				this.start();
			}
		});
	}
	stop() {
		if(this.#ffmpeg)
			this.#ffmpeg.stdin.write('q');
	}
	restart() {
		this.#restarting = true;
		this.stop();
	}
	async _read() {
		// eslint-disable-next-line no-constant-condition
		while(true) {
			const buff = this.#buffs.shift();
			if(buff === undefined) {
				//pause for a second to allow the RTSP stream to produce some data
				await new Promise(resolve => setTimeout(() => resolve(), 1000));
				continue;
			}
			if(!this.push(buff))
				break;
		}
	}
	_destroy(err, callback) {
		if(this.#ffmpeg)
			this.stop();
		callback(err);
	}
	get ffmpegInputArgs() {
		return this.#ffmpegInputArgs;
	}
	get restarting() {
		return this.#restarting;
	}
	get running() {
		return !!this.#ffmpeg;
	}
	get name() {
		return this.#name;
	}
	set name(v) {
		if(typeof v !== 'string')
			throw new TypeError('name must be a string.');
		if(v.length === 0)
			throw new TypeError('name cannot be empty.');
		if(ILLEGAL_CHARS.test(v))
			throw new TypeError('name may only contain alpanumeric, underscores, hyphens or spaces.');
		this.#name = v;
	}
	get captureInterval() {
		return this.#captureInterval;
	}
	set captureInterval(v) {
		if(isNaN(Number(v)))
			throw new TypeError('captureInterval must be numeric.');
		if(this.restarting)
			throw new RestartingError('Currently restarting. Please try again in a moment.');
		
		this.#captureInterval = Math.abs(Number(v));
		
		if(this.running)
			this.restart();
	}
	static fromObject(config) {
		if(config === null || typeof config !== 'object')
			throw new TypeError('config must be an Object.');
		
		return new this(
			config.name,
			config.captureInterval
		);
	}
}
