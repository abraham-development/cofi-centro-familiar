// Turbopack uses the dedicated Tailwind loader in next.config.js.
// Webpack uses the equivalent PostCSS integration for portable hosting builds.
const config = {
  plugins: process.env.TURBOPACK ? {} : { "@tailwindcss/postcss": {} },
};

export default config;
