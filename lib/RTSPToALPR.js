import EventEmitter from 'events';
import RTSPToMJPEG from "./RTSPToMJPEG.js";
import MJPEGToJPEG from "./MJPEGToJPEG.js";
import ALPRDetect from "./ALPRDetect.js";

export default class RTSPToALPR extends EventEmitter {
    #rtspToMjpeg = null;
    #mjpegToJpeg = null;
    #alprDetect = null;

    constructor(rtspToMjpeg, mjpegToJpeg, alprDetect) {
		super();

        if(!(rtspToMjpeg instanceof RTSPToMJPEG))
            throw new TypeError('rtspToMjpeg must be an instance of RTSPToMJPEG.');
        if(!(mjpegToJpeg instanceof MJPEGToJPEG))
            throw new TypeError('mjpegToJpeg must be an instance of MJPEGToJPEG.');
        if(!(alprDetect instanceof ALPRDetect))
            throw new TypeError('alprDetect must be an instance of ALPRDetect.');

        this.#rtspToMjpeg = rtspToMjpeg;
        this.#mjpegToJpeg = mjpegToJpeg;
        this.#alprDetect = alprDetect;

		this.#mjpegToJpeg.on('jpeg', jpeg => this.detect(jpeg));
		this.#rtspToMjpeg.pipe(this.#mjpegToJpeg);
    }
	async detect(jpeg) {
		const data = await this.#alprDetect.detect(jpeg);
		if(data.results.length > 0)
			this.emit('detect', data, jpeg);
	}
    static fromObject(config) {
        if(config === null || typeof config !== 'object')
            throw new TypeError('config must be an Object.');

        return new this(
			RTSPToMJPEG.fromObject(config.rtsp),
			MJPEGToJPEG.fromObject(config.mjpegToJpeg),
			ALPRDetect.fromObject(config.alpr)
        );
    }
}