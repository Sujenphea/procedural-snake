# WebGL Snake Animation

This project explores procedural snake motion using steering forces, endless curve generation, and instanced GPU rendering to create smooth, responsive movement in real time.

![WebGL Snake Demo](https://tympanus.net/codrops/wp-content/uploads/2026/02/snake.webp)

[Article on Codrops](https://tympanus.net/codrops/?p=108307)

[Demo](https://tympanus.net/Tutorials/WebGLSnakeAnimation/)

## Features

- **Procedural Motion**: Steering-based direction blended in real time
- **Endless Curve Path**: Incremental Bézier generation with sliding-window management
- **Stable Orientation**: Parallel transport frames for twist-free surface alignment
- **GPU Instanced Rendering**: Efficient body rendering driven entirely by shaders
- **Anatomical Shaping & Lighting**: Non-uniform profile, subtle twist, and scale-like surface detail

## Development

Start the development server with hot module replacement:

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Building for Production

Create an optimized production build:

```bash
npm run build
```

The built files will be in the `dist/` directory. Preview the production build:

```bash
npm run preview
```

## Credits

## Misc

Follow Sujen: [Twitter](https://x.com/sujen_p), [GitHub](https://github.com/Sujenphea), [Linkedin](https://www.linkedin.com/in/sujenphea/)

Follow Codrops: [X](http://www.x.com/codrops), [Facebook](https://www.facebook.com/codrops), [Instagram](https://www.instagram.com/codropsss/), [LinkedIn](https://www.linkedin.com/company/codrops/), [GitHub](https://github.com/codrops)

## License

[MIT](LICENSE)
