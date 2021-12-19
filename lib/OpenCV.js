import cv from './opencv/opencv.js';

//wait for WebAssembly to initialize
await new Promise(resolve => {
	// preRun() is another callback like onRuntimeInitialized() but is called just before the
	// library code runs. Here we mount a local folder in emscripten filesystem and we want to
	// do this before the library is executed so the filesystem is accessible from the start
	const FS = Module.FS;
	const rootDir = '/work';
	const localRootDir = process.cwd();
	cv.preRun = () => {
		// create rootDir if it doesn't exists
		if (!FS.analyzePath(rootDir).exists) {
			FS.mkdir(rootDir);
		}

		// FS.mount() is similar to Linux/POSIX mount operation. It basically mounts an external
		// filesystem with given format, in given current filesystem directory.
		FS.mount(FS.filesystems.NODEFS, { root: localRootDir }, rootDir);
	}
	cv.onRuntimeInitialized = () => {
		// We change emscripten current work directory to 'rootDir' so relative paths are resolved
		// relative to the current local folder, as expected
		cv.FS.chdir(rootDir)
		resolve();
	};
});

export default cv;