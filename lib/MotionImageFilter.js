import ImageFilter from './ImageFilter.js';
import sharp from 'sharp';
import cv from './OpenCV.js'
import RawImage from './RawImage.js';

const PROCESSING_WIDTH = 640;

export default class MotionImageFilter extends ImageFilter {
	#priorRawImage = null;
	#queue = [];
	async next(rawImage) {
		super.next(rawImage);
		
		return await this.enqueue(rawImage, async (priorRawImage) => {
			try {
				//bail if the priorMat wasn't set
				if(!priorRawImage) return;
				
				const src = rawImage.toMat();
				const last = priorRawImage.toMat();
				const dst = new cv.Mat();
				const lst = new cv.Mat();

				//resize
				const scale = PROCESSING_WIDTH/src.cols;
				const dsize = new cv.Size(PROCESSING_WIDTH, scale*src.rows);
				cv.resize(src, dst, dsize, 0, 0, cv.INTER_AREA);
				cv.resize(last, lst, dsize, 0, 0, cv.INTER_AREA);
				// src.delete();
				last.delete();
				
				//convert to grayscale
				cv.cvtColor(dst, dst, cv.COLOR_BGR2GRAY);
				cv.cvtColor(lst, lst, cv.COLOR_BGR2GRAY);
				
				//apply gaussian blur
				const ksize = new cv.Size(15, 15);
				cv.GaussianBlur(dst, dst, ksize, 0, 0, cv.BORDER_DEFAULT);
				cv.GaussianBlur(lst, lst, ksize, 0, 0, cv.BORDER_DEFAULT);
				
				//get the diff in pixels between the prior mat and this one
				cv.absdiff(lst, dst, dst);
				lst.delete();
				
				//convert to black and white
				cv.threshold(dst, dst, 25, 255, cv.THRESH_BINARY);
				
				//dilate the image
				const M = cv.Mat.ones(5, 5, cv.CV_8U);
				cv.dilate(dst, dst, M, new cv.Point(-1, -1), 1, cv.BORDER_CONSTANT);
				M.delete();
				
				//find the contours
				const contours = new cv.MatVector();
				const hierarchy = new cv.Mat();
				cv.findContours(dst, contours, hierarchy, cv.RETR_CCOMP, cv.CHAIN_APPROX_SIMPLE);
				hierarchy.delete();
				
				//map the contours into bounding boxes
				const rects = [];
				for(let i = 0; i < contours.size(); i++)
					rects.push(cv.boundingRect(contours.get(i)));
				contours.delete();

				//no motion detected?
				if(rects.length === 0)
					rawImage.clear();
				else {
					//sort the bounding boxes by size descending
					rects.sort((a, b) => {
						const aArea = a.width * a.height;
						const bArea = b.width * b.height;
						return bArea - aArea;
					});

					const { x, y, width, height } = rects[0];

					// //TODO: figure out why cv.roi produced corrupt images
					// const rect = new cv.Rect(x/scale, y/scale, width/scale, height/scale);
					// const roi = src.roi(rect);
					// rawImage.loadMat(roi);
					// roi.delete();
				
					//crop the rawImage using the largest bounding box
					await rawImage.crop(
						Math.round(x/scale),
						Math.round(y/scale),
						Math.round(width/scale),
						Math.round(height/scale)
					);
				}
	
				src.delete();
				dst.delete();
			}
			catch(err) {
				console.log(err.stack);
				return Buffer.from([]);
			}
		});
		
		
	}
	async enqueue(rawImage, job) {
		//create an object and push it into the queue
		const obj = { rawImage, job };
		this.#queue.push(obj);
		//loop until this object is at the front of the queue
		while(this.#queue.indexOf(obj) !== 0)
			await new Promise(resolve => setTimeout(resolve, 10));
		//capture the prior rawImage
		const priorRawImage = this.#priorRawImage;
		//assign to a copy of the current rawImage
		this.#priorRawImage = RawImage.copy(rawImage);
		//run the job
		await job(priorRawImage);
		//remove the object from the queue
		this.#queue.shift();
	}
}