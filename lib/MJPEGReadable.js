import { Readable } from 'stream';
import { spawn } from 'child_process';
import pathToFfmpeg from 'ffmpeg-static';

export default class MJPEGReadable extends Readable {
	#name = null;
	#captureInterval = null;
	#ffmpeg = null;
	#ffmpegInputArgs = [];
	#buffs = [];

	constructor(name, captureInterval) {
		super();

		if(typeof name !== 'string')
			throw new TypeError('name must be a string.');
		if(typeof captureInterval !== 'number')
			throw new TypeError('captureInterval must be an number.');
		
		this.#name = name;
		this.#captureInterval = captureInterval;
		this.#ffmpegInputArgs = ['-f', 'lavfi', '-i', 'smptebars'];
	}
	_construct(callback) {
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
		});

		callback();
	}
	get ffmpegInputArgs() {
		return this.#ffmpegInputArgs;
	}
	async _read() {
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
			this.#ffmpeg.stdin.write('q');
		callback(err);
	}
	get name() {
		return this.#name;
	}
	get captureInterval() {
		return this.#captureInterval;
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
