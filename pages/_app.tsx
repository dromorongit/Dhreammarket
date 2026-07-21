import React from 'react';
import { AppProps } from 'next/app';
import Head from 'next/head';

function MyApp({ Component, pageProps }) {
  return (
    <Head>
      <script
        src="https://www.googletagmanager.com/gtag/js?id=G-QCL4XW5FR1"
        async
      />
      <script
        nonce="{Math.random().toString(36).substr(2, 9)}"
        dangerouslySetInnerHTML={{ __html: `window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date()); gtag('config', 'G-QCL4XW5FR1');` }}
      />
    </Head>
    <Component {...pageProps} />
  );
}

export default MyApp;