import React from 'react';
import { AppProps } from 'next/app';
import Head from 'next/head';
import Script from 'next/script';

function MyApp({ Component, pageProps }) {
  return (
    <>
      <Head>
        <script
          src="https://www.googletagmanager.com/gtag/js?id=G-QCL4XW5FR1"
          strategy="lazyOnload"
        />
        <Script
          strategy="beforeInteractive"
        >
          {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-QCL4XW5FR1');`}
        </Script>
      </Head>
      <Component {...pageProps} />
    </>
  );
}

export default MyApp;