"use strict";
/// <reference path="genetic-algorithm.ts" />
/// <reference path="neural-network.ts" />
var FlappyBird;
(function (FlappyBird) {
    const canvas = document.querySelector('#flappy-bird');
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const backgroundSpeed = 0.5;
    let backgroundx = 0;
    const spawnInterval = 90;
    let generationNumber = 0;
    let alives = 0;
    let fps = 60;
    // tslint:disable-next-line:no-any
    let population, images, score, interval, pipes, birds;
    function start() {
        interval = 0;
        score = 0;
        pipes = [];
        birds = [];
        population = GeneticAlgorithm.evolve();
        for (const _ in population) {
            birds.push(new Bird());
        }
        generationNumber++;
        alives = birds.length;
    }
    function update() {
        backgroundx += backgroundSpeed;
        let aperturePos = 0;
        // Get the location of the next pipe.
        if (birds.length > 0) {
            for (let i = 0; i < pipes.length; i += 2) {
                const pipe = pipes[i];
                if (pipe.x + pipe.width > birds[0].x) {
                    aperturePos = pipe.height / height;
                    break;
                }
            }
        }
        // Pass the inputs to each bird's network, and act on the output.
        for (const i in birds) {
            const bird = birds[i];
            if (bird.alive) {
                const inputs = [bird.y / height, aperturePos];
                const decision = population[i].compute(inputs)[0];
                if (decision > 0.5) {
                    bird.flap();
                }
                bird.update();
                if (bird.isDead(height, pipes)) {
                    bird.alive = false;
                    alives--;
                    population[i].fitness = score;
                    if (gameOver()) {
                        start();
                    }
                }
            }
        }
        // Update pipes.
        for (let i = 0; i < pipes.length; i++) {
            pipes[i].update();
            if (pipes[i].isOutOfViewport()) {
                pipes.splice(Number(i), 1);
                i--;
            }
        }
        if (interval === 0) {
            const birdDelta = 50;
            const apertureSize = 120;
            const aperturePos = Math.round(Math.random() * (height - birdDelta * 2 - apertureSize)) + birdDelta;
            pipes.push(new Pipe(width, 0, undefined, aperturePos));
            pipes.push(new Pipe(width, apertureSize + aperturePos, undefined, height));
        }
        interval++;
        if (interval === spawnInterval) {
            interval = 0;
        }
        score++;
        if (fps === 0) {
            window.setZeroTimeout(() => { update(); });
        }
        else {
            setTimeout(update, 1000 / fps);
        }
    }
    function display() {
        ctx.clearRect(0, 0, width, height);
        // Draw background.
        for (let i = 0; i < Math.ceil(width / images.bg.width) + 1; i++) {
            ctx.drawImage(images.bg, i * images.bg.width - Math.floor(backgroundx % images.bg.width), 0);
        }
        // Draw pipes.
        for (const i in pipes) {
            const pipe = pipes[i];
            if (Number(i) % 2 === 0) {
                ctx.drawImage(images.pipeTop, pipe.x, pipe.y + pipe.height - images.pipeTop.height, pipe.width, images.pipeTop.height);
            }
            else {
                ctx.drawImage(images.pipeBottom, pipe.x, pipe.y, pipe.width, images.pipeTop.height);
            }
        }
        ctx.fillStyle = "#FFC600";
        ctx.strokeStyle = "#CE9E00";
        // Draw birds.
        for (const i in birds) {
            const bird = birds[i];
            if (bird.alive) {
                ctx.save();
                ctx.translate(bird.x + bird.width / 2, bird.y + bird.height / 2);
                ctx.rotate(Math.PI / 2 * bird.gravity / 20);
                ctx.drawImage(images.bird, -bird.width / 2, -bird.height / 2, bird.width, bird.height);
                ctx.restore();
            }
        }
        ctx.fillStyle = "white";
        ctx.font = "20px monospace";
        ctx.fillText(`Score : ${score}`, 10, 25);
        ctx.fillText(`Generation : ${generationNumber}`, 10, 50);
        ctx.fillText(`Population : ${alives} of ${population.length}`, 10, 75);
        requestAnimationFrame(() => { display(); });
    }
    function gameOver() {
        for (const bird of birds) {
            if (bird.alive) {
                return false;
            }
        }
        return true;
    }
    function loadImages(sources, callbackfn) {
        let n = 0, loaded = 0;
        const imgs = {};
        for (const i in sources) {
            n++;
            imgs[i] = new Image();
            imgs[i].src = sources[i];
            imgs[i].onload = () => {
                loaded++;
                if (loaded === n) {
                    callbackfn(imgs);
                }
            };
        }
    }
    FlappyBird.setSpeed = (newFPS) => { fps = newFPS; };
    window.onload = () => {
        const sprites = {
            bird: './img/flaby.png',
            bg: './img/bg.png',
            pipeTop: './img/pipetop.png',
            pipeBottom: './img/pipebottom.png'
        };
        function init() {
            start();
            update();
            display();
        }
        loadImages(sprites, (imgs) => {
            images = imgs;
            init();
        });
    };
    // Workaround for immediate execution.
    (() => {
        const timeouts = [];
        const message = "zero-timeout-message";
        function setZeroTimeout(fn) {
            timeouts.push(fn);
            window.postMessage(message, "*");
        }
        function handleMessage(event) {
            if (event.source === window && event.data === message) {
                event.stopPropagation();
                if (timeouts.length > 0) {
                    const fn = timeouts.shift();
                    fn();
                }
            }
        }
        window.addEventListener("message", handleMessage, true);
        window.setZeroTimeout = setZeroTimeout || {};
    })();
    class Bird {
        constructor(x = 80, y = 250, height = 30, width = 40, gravity = 0, velocity = 0.3, jump = -6, alive = true) {
            this.x = x;
            this.y = y;
            this.height = height;
            this.width = width;
            this.gravity = gravity;
            this.velocity = velocity;
            this.jump = jump;
            this.alive = alive;
        }
        flap() { this.gravity = this.jump; }
        update() {
            this.gravity += this.velocity;
            this.y += this.gravity;
        }
        isDead(height, pipes) {
            if (this.y >= height || this.y + this.height <= 0) {
                return true;
            }
            for (const pipe of pipes) {
                if (!(this.x > pipe.x + pipe.width ||
                    this.x + this.width < pipe.x ||
                    this.y > pipe.y + pipe.height ||
                    this.y + this.height < pipe.y)) {
                    return true;
                }
            }
            return false;
        }
    }
    class Pipe {
        constructor(x = 0, y = 0, width = 50, height = 40, speed = 3) {
            this.x = x;
            this.y = y;
            this.width = width;
            this.height = height;
            this.speed = speed;
        }
        update() { this.x -= this.speed; }
        isOutOfViewport() { return this.x + this.width < 0; }
    }
})(FlappyBird || (FlappyBird = {}));
//# sourceMappingURL=flappy-bird.js.map