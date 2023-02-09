"use strict";

/*
    Where marked "@license MIT (...)"" below:

    Copyright (c) [inline specified year] [inline specified copyright owner]

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in all
    copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
    SOFTWARE.

    =============================================================================

	Where marked "@license BSD 2C (...)"" below:

	BSD 2-Clause License
	
	Copyright (c) [inline specified year] [inline specified copyright owner]
	All rights reserved.

	Redistribution and use in source and binary forms, with or without
	modification, are permitted provided that the following conditions are met:

	* Redistributions of source code must retain the above copyright notice, this
	  list of conditions and the following disclaimer.

	* Redistributions in binary form must reproduce the above copyright notice,
	  this list of conditions and the following disclaimer in the documentation
	  and/or other materials provided with the distribution.

	THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
	AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
	IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
	DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
	FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
	DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
	SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
	CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
	OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
	OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

    =============================================================================

	For code marked with "@license Apache 2.0 (...)"" below:

    Copyright [inline specified year] [inline specified copyright owner]

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at
 
        http://www.apache.org/licenses/LICENSE-2.0
 
    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
*/

/* Preserve Apache license above! It's relevant after building. */

/* @license MIT    - Copyright 2023, Luke Pflibsen-Jones - credit: port from TensorFlow 2 to TensorFlowJS               */
/* @license MIT    - Copyright 2021, Bosco Yung          - credit: port of Marc Dietrichstein's port to TensorFlow 2    */
/* @license BSD 2C - Copyright 2017, Marc Dietrichstein  - credit: original port from Yahoo's Caffe model to TensorFlow */
/* @license BSD 2C - Copyright 2016, Yahoo Inc.          - credit: creator of the OpenNSFW project                      */


import * as tf from '@tensorflow/tfjs';

tf.enableProdMode();

// ====

type NSFWResult = {
    nsfw_confidence: number;
    is_nsfw: boolean;
}

type Images = ImageData | HTMLImageElement | HTMLCanvasElement | ImageBitmap;

// ====

export class OpenNSFW {
    private image_size: number;
    private nsfw_threshold: number;
    private model_path: string;
    private model: tf.GraphModel | null;
    private load_promise: Promise<void>;
    private loaded: boolean;
    private static indexeddb_name = 'opennsfw';
    private static model_url      = 'https://raw.githubusercontent.com/lukepfjo/YouTube-Spam-Remover/main/src/extern/opennsfwjs/model/model.json';

    /**
     * A image classifier that determines an image's inappropriateness (in regards to nudity) with percent certainty.
     * This percentage roughly correlates to the amount of nudity present in an image.
     * 
     * Utilizes a ported version of Yahoo's OpenNSFW model.
     * 
     * @param nsfw_threshold The threshhold percentage (as a decimal) at which the image should be considered NSFW
    **/
    constructor(nsfw_threshold: number = .21) {
        this.image_size     = 224;
        this.nsfw_threshold = nsfw_threshold;
        this.model          = null;
        this.loaded         = false;


        this.classifyImages      = this.classifyImages.bind(this);
        this.classifySingleImage = this.classifySingleImage.bind(this);
        this.prime               = this.prime.bind(this);
        this.save                = this.save.bind(this);
        this.load                = this.load.bind(this);
        this.isLoaded            = this.isLoaded.bind(this);
        this.getLoadPromise      = this.getLoadPromise.bind(this);
        this.imageToImageData    = this.imageToImageData.bind(this);
        this.preprocessImage     = this.preprocessImage.bind(this);
        this.isCached            = this.isCached.bind(this);
    }

    /**
     * Run the OpenNSFW model against an image
     * 
     * @param images A single image or array of images of these types: ImageData, HTMLImageElement, HTMLCanvasElement, ImageBitmap
     * @returns A promise that resolves to a single result or an array of results in the format:
     *          {nsfw_confidence = (0.0 - 1.0),
     *           is_nsfw = (nsfw_confidence > this.nsfw_threshold)}
    **/
    public async classifyImages(images: Images | Images[]): Promise<NSFWResult | NSFWResult[]> {
        if (!this.loaded) {
            throw new Error("OpenNSFW :: model has not been loaded yet.");
        }

        // Run the classification process, returning a promise that resolves to a single or array of NSFWResult(s)
        if (typeof images[Symbol.iterator] !== 'function') {
            return this.classifySingleImage(images as Images);
        } else {
            return Promise.all(Array.prototype.map(this.classifySingleImage, images));
        }
    }

    /**
     * Preprocess and classify an image-like object using the model
     * 
     * @param image An image-like object to run against the model
     * @returns The NSFWResult representing the resulting classification
    **/
    private async classifySingleImage(image: Images): Promise<NSFWResult> {
        return new Promise(async (resolve) => {
            // Workaround for browser security protections caused by interacting directly with image elements
            if (image['src']) {
                image = await this.imageToImageData((image as HTMLImageElement).src);
            }

            // Get the image into a format that's compatible with the model
            const image_tensor = this.preprocessImage(image);

            // tf.tidy() help protect against memory leaks; we aren't working with tf primitives, but
            // there's no reason not to use it.
            const output_tensor = tf.tidy(() => {
                return this.model.execute({ 'input': image_tensor },  ['predictions']) as tf.Tensor2D;
            });

            const raw_result = await output_tensor.data();
            resolve({'nsfw_confidence': raw_result[1], 'is_nsfw': raw_result[1] >= this.nsfw_threshold});
        });
    }

    /**
     * Feeds the model initial data to ensure subsequent classifications are fast.
     * The longer run time of the first image is unfortunately intrinsic to this variety of ML model.
     *
     * @returns A void promise that resolves when the priming finishes
    **/
    public async prime(): Promise<void> {
        if (!this.loaded) {
            throw new Error("OpenNSFW :: model has not been loaded yet.");
        }

        console.debug('OpenNSFW :: priming');

        const output_tensor = tf.tidy(() => {
            return this.model.execute({ 'input': tf.zeros([1, 224, 224, 3])},  ['predictions']) as tf.Tensor2D;
        });

        return new Promise<void>(resolve => {
            output_tensor.data().then(() => {
                console.debug('OpenNSFW :: primed');
                resolve();
            });
        });
    }

    /**
     * Save the model locally for future use (IndexedDB)
     * 
     * @returns A void promise that resolves once the save is complete
    **/
    public async save(): Promise<void> {
        if (!this.loaded) {
            throw new Error("OpenNSFW :: model has not been loaded yet.");
        }

        return new Promise(async resolve => {
            console.debug('OpenNSFW :: saving model to local database...');

            this.model_path = `indexeddb://${OpenNSFW.indexeddb_name}`;
            await this.model.save(this.model_path);

            console.debug('OpenNSFW :: model saved');

            resolve();
        });
    }

    /**
     * Load the model either from the project's GitHub repo or from the local cache (if it exists)
     * 
     * @param save_after_loaded Whether or not to save the model locally immediately after loading (see this.save())
     * @returns A void promise that resolves once the load has completed
    **/
    public async load(save_after_loaded: boolean = true): Promise<void> {
        return new Promise(async resolve => {
            tf.serialization.registerClass(PadTensor);

            const was_cached = await this.isCached();

            if (was_cached) {
                console.debug('OpenNSFW :: model was cached, loading...');
                this.model_path = `indexeddb://${OpenNSFW.indexeddb_name}`;
    
            } else {
                console.debug('OpenNSFW :: model was not cached, fetching from GitHub...');
                this.model_path = OpenNSFW.model_url;
            }

            this.load_promise = new Promise(async resolve => {
                this.model = await tf.loadGraphModel(this.model_path);
                this.loaded = true;
                resolve();
            });

            await this.load_promise;
    
            if (!was_cached && save_after_loaded) {
                this.save();
            }
    
            console.debug('OpenNSFW :: model loaded');
            resolve();
        });
    }

    /**
     * Gets the load state of the model
     * 
     * @returns A boolean representing whether or not the model has loaded
    **/
    public isLoaded(): boolean {
        return this.loaded;
    }

    /**
     * Provides additional access to the model's load promise
     * 
     * @returns A promise that resolves once the model load has completed
    **/
    public async getLoadPromise(): Promise<void> {
        return this.load_promise;
    }

    /**
     * Fetches an image from the provided URL and converts it to ImageData
     * 
     * @param image_src The URL at which the image resides
     * @returns A promise that resolves to ImageData containing the provided image
    **/
    private async imageToImageData(image_src: string): Promise<ImageData> {
        return new Promise(async (resolve) => {
            let image_response = null;

            try {
                image_response = await fetch(image_src);
        
            } catch (error) {
                if (error.name === 'NetworkError') {
                    console.error(`OpenNSFW :: NetworkError while fetching image ${image_src}: ${error.message}`);
                    return;
                } else {
                    throw error;
                }
            }

            const image_blob = await image_response.blob();
            const bitmap = await createImageBitmap(image_blob);

            const canvas = new OffscreenCanvas(this.image_size, this.image_size);
            const context = canvas.getContext("2d");
            context.drawImage(bitmap, 0, 0, this.image_size, this.image_size);
        
            resolve(context.getImageData(0, 0, this.image_size, this.image_size));
        });
    }

    /**
     * Changes the image into a format and shape that is compatible with the model
     * 
     * @param image An image-like object on which to run the preprocessing
     * @returns A tensor representation of the preprocessed image
    **/
    private preprocessImage(image: ImageData | HTMLImageElement | HTMLCanvasElement | ImageBitmap): tf.Tensor {
        return tf.tidy(() => {
            const decoded_image = tf.browser.fromPixels(image, 3)
                                            .toFloat();

            // Resize the image to 224 x 224; the size of image the model was trained on
            const resized = tf.image.resizeBilinear(decoded_image, [this.image_size, this.image_size], true);

            // Reshape the tensor to match what the input expects
            let tensor = resized.reshape([1, this.image_size, this.image_size, 3]);

            // Convert RGB to BGR
            tensor = tf.reverse(tensor, -1);

            // Subtract the training dataset mean value of each channel.
            tensor = tf.sub(tensor, [104.0, 117.0, 123.0]);

            return tensor;
        });
    }
    
    /**
     * Check the browser's IndexedDB storage for the model
     * 
     * @returns A promise thats resolves to a boolean representing whether or not the model was cached
    **/
    private async isCached(): Promise<boolean> {
        return new Promise((resolve) => {
            // Ask for database session
            // This creates the database if it doesn't already exist, which breaks tensorflowjs, so we need to run a db upgrade
            const db_open_request = indexedDB.open('tensorflowjs', 1);
    
            // DB didn't exist yet, or our version number has changed
            db_open_request.onupgradeneeded = () => {
                // Get reference to database session instance
                let idb_instance = db_open_request.result;
    
                // Open a database transaction; empty array for "no object stores exist to even get permission for!"
                let transaction: any = idb_instance.transaction([], 'readwrite', {'durability': 'strict'});
    
                transaction.createObjectStore("models_store");
                transaction.createObjectStore("model_info_store");
    
                transaction.commit();
                resolve(false);
            };
    
            db_open_request.onsuccess = async() => {
                // Reference to database
                let idb_instance = db_open_request.result;
    
                let transaction = idb_instance.transaction(['models_store'], 'readonly');
                let obj = transaction.objectStore('models_store');
                let req: IDBRequest<any> | null = null;
                
                await new Promise<void>((_res, _rej) => {
                    let obj_req = obj.get(OpenNSFW.indexeddb_name);
    
                    obj_req.onsuccess = () => {
                        req = obj_req;
                        _res();
                    }
    
                    obj_req.onerror = _rej;
                });
    
                resolve((req as any).result?.modelPath === OpenNSFW.indexeddb_name);
            };
    
            db_open_request.onerror = () => {
                resolve(false);
                throw new Error('Encountered database error while trying to load OpenNSFW model');
            }

            db_open_request.onblocked = () => {
                resolve(false);
                throw new Error('Database access was blocked while trying to load OpenNSFW model');
            }
        });
    }
}

// Make OpenNSFW class available globally in case the user is not using JS modules
global.OpenNSFW = OpenNSFW;


class PadTensor extends tf.layers.Layer {
    padding: any;
    shape: number[];

    constructor(_) {
        super({ });

        // The padding you are adding in the Keras model
        this.padding = [[0, 0], [3, 3], [3, 3], [0, 0]];
        
        // The output shape after padding -- you can get this quickly by printing
        // tensor.shape after the tf.pad operation in your Python Keras code.
        // None = null
        this.shape = [null, 230, 230, 3];
    }

    computeOutputShape(_: any): tf.Shape {
        return this.shape;
    }

    call(input: any, _: any): tf.Tensor | tf.Tensor[] {
        // tf.pad can accept either a tensor or an array of tensors
        if (typeof input === 'object') {
            return Array.prototype.map(t => tf.pad(t, this.padding), input);
        } else {
            return tf.pad(input, this.padding);
        }
    }
    
    getConfig() { return super.getConfig(); }

    getClassName() { return 'PadTensor'; }
    static get className() { return 'PadTensor'; }
}
