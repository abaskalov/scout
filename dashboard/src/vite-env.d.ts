/// <reference types="vite/client" />

declare module 'rrweb-player' {
  interface RRWebPlayerOptions {
    target: HTMLElement;
    props: {
      events: unknown[];
      width?: number;
      height?: number;
      autoPlay?: boolean;
      showController?: boolean;
      speedOption?: number[];
    };
  }
  export default class RRWebPlayer {
    constructor(options: RRWebPlayerOptions);
    destroy(): void;
  }
}

declare module 'rrweb-player/dist/style.css' {
  const content: string;
  export default content;
}
