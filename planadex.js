class EventEmitter {
    constructor() {
        this.listeners = {}
    }
    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = []
        }
        this.listeners[event].push(callback)
    }
    off(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event] = this.listeners[event].filter(cb => cb !== callback)
        }
    }
    emit(event, ...args) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(callback => callback(...args))
        }
    }
}
class SceneNode extends EventEmitter {
    constructor() {
        super();
        this.children = [];
        this.parent = null
    }
    addChild(child) {
        this.children.push(child);
        child.parent = this
    }
    removeChild(child) {
        const index = this.children.indexOf(child);
        if (index !== -1) {
            this.children.splice(index, 1);
            child.parent = null
        }
    }
    update(deltaTime) {
        this.children.forEach(child => child.update(deltaTime))
    }
    render(ctx) {
        this.children.forEach(child => child.render(ctx))
    }
}
class Planadex extends EventEmitter {
    constructor(width, height, parentElement = document.body) {
        super();
        this.width = width;
        this.height = height;
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = width;
        this.canvas.height = height;
        parentElement.appendChild(this.canvas);
        this.root = new SceneNode();
        this.particles = [];
        this.keys = {};
        this.gravity = 0.5;
        this.friction = 0.98;
        this.lastUpdateTime = 0;
        this.deltaTime = 0;
        this.sounds = {};
        this.shaders = {};
        this.lights = [];
        this.camera = {
            x: 0,
            y: 0,
            zoom: 1
        };
        this.tweens = [];
        window.addEventListener('keydown', (e) => this.keys[e.code] = !0);
        window.addEventListener('keyup', (e) => this.keys[e.code] = !1)
    }
    addEntity(entity) {
        this.root.addChild(entity)
    }
    removeEntity(entity) {
        this.root.removeChild(entity)
    }
    addParticles(particleSystem) {
        this.particles.push(particleSystem)
    }
    loadSound(event, src) {
        const sound = new Audio(src);
        this.sounds[event] = sound
    }
    playSound(event, options = {}) {
        const {
            volume = 1.0, loop = !1
        } = options;
        if (this.sounds[event]) {
            this.sounds[event].volume = volume;
            this.sounds[event].loop = loop;
            this.sounds[event].play()
        }
    }
    stopSound(event) {
        if (this.sounds[event]) {
            this.sounds[event].pause();
            this.sounds[event].currentTime = 0
        }
    }
    addShader(name, vertexShaderSource, fragmentShaderSource) {
        const shader = new Shader(this.ctx, vertexShaderSource, fragmentShaderSource);
        this.shaders[name] = shader
    }
    addLight(light) {
        this.lights.push(light)
    }
    updateCamera(x, y, zoom) {
        this.camera.x = x;
        this.camera.y = y;
        this.camera.zoom = zoom
    }
    addVectorShape(path) {
        const shape = new VectorShape(path);
        this.addEntity(shape);
        return shape
    }
    addTween(target, properties, duration, easing) {
        const tween = new Tween(target, properties, duration, easing);
        this.tweens.push(tween);
        return tween
    }
    update(time) {
        this.deltaTime = time - this.lastUpdateTime;
        this.root.update(this.deltaTime);
        this.particles.forEach(particleSystem => particleSystem.update(this.deltaTime));
        this.tweens = this.tweens.filter(tween => tween.update(time));
        this.checkCollisions();
        this.lastUpdateTime = time;
        this.emit('update', this.deltaTime)
    }
    render() {
        this.ctx.save();
        this.ctx.translate(-this.camera.x, -this.camera.y);
        this.ctx.scale(this.camera.zoom, this.camera.zoom);
        this.ctx.clearRect(0, 0, this.width, this.height);
        this.applyLighting();
        this.root.render(this.ctx);
        this.particles.forEach(particleSystem => particleSystem.render(this.ctx));
        this.ctx.restore()
    }
    applyLighting() {
        this.ctx.globalCompositeOperation = 'multiply';
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this.ctx.fillRect(0, 0, this.width, this.height);
        this.lights.forEach(light => {
            const gradient = this.ctx.createRadialGradient(light.x, light.y, 0, light.x, light.y, light.radius);
            gradient.addColorStop(0, light.color);
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
            this.ctx.globalCompositeOperation = 'lighter';
            this.ctx.fillStyle = gradient;
            this.ctx.fillRect(light.x - light.radius, light.y - light.radius, light.radius * 2, light.radius * 2)
        });
        this.ctx.globalCompositeOperation = 'source-over'
    }
    gameLoop(time = 0) {
        this.update(time);
        this.render();
        requestAnimationFrame(this.gameLoop.bind(this))
    }
    start() {
        this.lastUpdateTime = performance.now();
        this.gameLoop()
    }
    checkCollisions() {
        const entities = this.getAllEntities(this.root);
        for (let i = 0; i < entities.length; i++) {
            for (let j = i + 1; j < entities.length; j++) {
                if (this.isColliding(entities[i], entities[j])) {
                    this.resolveCollision(entities[i], entities[j])
                }
            }
        }
    }
    getAllEntities(node) {
        let entities = [];
        if (node instanceof Entity) {
            entities.push(node)
        }
        node.children.forEach(child => {
            entities = entities.concat(this.getAllEntities(child))
        });
        return entities
    }
    isColliding(entityA, entityB) {
        return entityA.x < entityB.x + entityB.width && entityA.x + entityA.width > entityB.x && entityA.y < entityB.y + entityB.height && entityA.y + entityA.height > entityB.y
    }
    resolveCollision(entityA, entityB) {
        const overlapX = (entityA.width / 2 + entityB.width / 2) - Math.abs(entityA.x - entityB.x);
        const overlapY = (entityA.height / 2 + entityB.height / 2) - Math.abs(entityA.y - entityB.y);
        if (overlapX < overlapY) {
            entityA.velocityX = -entityA.velocityX * entityA.bounceFactor;
            if (entityA.x < entityB.x) {
                entityA.x -= overlapX
            } else {
                entityA.x += overlapX
            }
        } else {
            entityA.velocityY = 0;
            entityA.isOnGround = !0;
            if (entityA.y < entityB.y) {
                entityA.y -= overlapY
            } else {
                entityA.y += overlapY
            }
        }
    }
}
