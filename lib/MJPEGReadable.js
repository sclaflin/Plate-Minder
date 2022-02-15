import { Readable } from 'stream';
import { spawn } from 'child_process';
import { FFMPEG_PATH, READABLE_RETRY_DELAY } from './constants.js';
import Arguments from './Arguments.js';

export class RestartingError extends Error {}

export const ILLEGAL_CHARS = /[^A-Za-z0-9-_ ]/;

export default class MJPEGReadable extends Readable {
	#name = null;
	#captureInterval = null;
	#ffmpeg = null;
	#preInputArgs = null;
	#inputArgs = null;
	#preOutputArgs = null;
	#buffs = [];
	#errCode = null;
	#errBuff = null;
	#alwaysRestart = false;
	#retryAttempt = 0;
	#retryTimeout = null;
	#restarting = false;

	constructor(name, captureInterval) {
		super();

		
		this.name = name;
		this.captureInterval = captureInterval;
		this.#preInputArgs = Arguments.fromArgs();
		this.#inputArgs = Arguments.fromArgs('-f', 'lavfi', '-i', 'smptebars');
		this.#preOutputArgs = Arguments.fromArgs();
	}
	_construct(callback) {
		this.start();

		callback();
	}
	start() {
		//do nothing if there's already a process running
		if(this.running) return;

		this.#errCode = null;
		this.#errBuff = null;

		const args = [
			//Don't show the noisy ffmpeg banner
			'-hide_banner',
			//Only squak on errors
			'-loglevel', 'error',
			//Include additional pre-input arguments
			...this.#preInputArgs,
			//Include input arguments
			...this.#inputArgs,
			//Output as mjpeg
			'-f', 'mjpeg',
			//Output quality (lower is better, but slower)
			'-q:v', '4',
			//Framerate of mjpeg stream
			'-r', `1/${this.#captureInterval}`,
			//Remove audio
			'-an',
			//Include additonal pre-output arguments
			...this.#preOutputArgs,
			//Stream output to stdout
			'-'
		];
		
		this.#ffmpeg = spawn(FFMPEG_PATH, args);
		this.#ffmpeg.stdout.on('data', data => {
			this.#buffs.push(data);
		});
		this.#ffmpeg.stderr.on('data', data => {
			this.#errBuff = data;
		});
		this.#ffmpeg.on('close', code => {
			this.#ffmpeg = null;
			if(code !== 0 || this.#alwaysRestart) {
				this.#errCode = code;
				this.emit('failed', this.errCode, this.errText);
				this.#retryTimeout = setTimeout(() => this.start(), READABLE_RETRY_DELAY * 1000);
			}
			if(this.#restarting) {
				this.#restarting = false;
				this.start();
			}
		});
	}
	stop() {
		clearTimeout(this.#retryTimeout);
		this.#retryTimeout = null;
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
	get errCode() {
		return this.#errCode;
	}
	get errText() {
		return this.#errBuff?.toString() ?? null;
	}
	get retryAttempt() {
		return this.#retryAttempt;
	}
	set retryAttempt(v) {
		if(!Number.isInteger(v))
			throw new TypeError('retryAttempt must be an integer.');
		this.#retryAttempt = v;
	}
	get preInputArgs() {
		return this.#preInputArgs;
	}
	get inputArgs() {
		return this.#inputArgs;
	}
	get preOutputArgs() {
		return this.#preOutputArgs;
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
	get alwaysRestart() {
		return this.#alwaysRestart;
	}
	set alwaysRestart(v) {
		console.log(`always restart: ${v}`);
		if(typeof v !== 'boolean')
			throw new TypeError('alwaysRestart must be a boolean.');
		this.#alwaysRestart = v;
	}
	static fromObject(config) {
		if(config === null || typeof config !== 'object')
			throw new TypeError('config must be an Object.');
		
		const obj = new this(
			config.name,
			config.captureInterval
		);

		obj.preInputArgs.add(...(config.preInputArgs || []));
		obj.preOutputArgs.add(...(config.preOutputArgs || []));
		obj.alwaysRestart = config.alwaysRestart ?? false;

		return obj;
	}
}
