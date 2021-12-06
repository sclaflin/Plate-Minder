import EventEmitter from 'events';
import MJPEGToJPEG from "./MJPEGToJPEG.js";
import RTSPToMJPEG from './RTSPToMJPEG.js';
import ALPRDetect from "./ALPRDetect.js";
import MJPEGReadable from './MJPEGReadable.js';
import FileToMJPEG from './FileToMJPEG.js';

export default class MJPEGToALPR extends EventEmitter {
    #mjpegReadable = null;
    #mjpegToJpeg = null;
    #alprDetect = null;

    constructor(mjpegReadable, mjpegToJpeg, alprDetect) {
		super();

        if(!(mjpegReadable instanceof MJPEGReadable))
            throw new TypeError('mjpegReadable must be an instance of MJPEGReadable.');
        if(!(mjpegToJpeg instanceof MJPEGToJPEG))
            throw new TypeError('mjpegToJpeg must be an instance of MJPEGToJPEG.');
        if(!(alprDetect instanceof ALPRDetect))
            throw new TypeError('alprDetect must be an instance of ALPRDetect.');

        this.#mjpegReadable = mjpegReadable;
        this.#mjpegToJpeg = mjpegToJpeg;
        this.#alprDetect = alprDetect;

		this.#mjpegToJpeg.on('jpeg', jpeg => this.detect(jpeg));
		this.#mjpegReadable.pipe(this.#mjpegToJpeg);
    }
	async detect(jpeg) {
		const data = await this.#alprDetect.detect(jpeg);
		if(data.results.length > 0)
			this.emit('detect', data, jpeg);
	}
    static fromObject(config) {
        if(config === null || typeof config !== 'object')
            throw new TypeError('config must be an Object.');

        let mjpegReadable = null;
        switch(config.mjpegReadable.type) {
            case 'rtsp':
                mjpegReadable = RTSPToMJPEG;
                break;
            case 'file':
                mjpegReadable = FileToMJPEG;
                break;
            default:
                throw new Error('Invalid MJPEGReadable type.');
        }

        return new this(
			mjpegReadable.fromObject(config.mjpegReadable),
			MJPEGToJPEG.fromObject(config.mjpegToJpeg),
			ALPRDetect.fromObject(config.alpr)
        );
    }
}