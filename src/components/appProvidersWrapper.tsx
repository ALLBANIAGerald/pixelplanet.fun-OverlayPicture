import App from './app';

const AppProvidersWrapper = () => {
    return (
        <>
            <App></App>
            {/* <Provider store={appStore}>
            <ThemeProvider theme={theme}>
                <ScopedCssBaseline>
                    <ErrorBoundary
                        FallbackComponent={ErrorBoundaryFallbackModal}
                        onReset={() => {
                            setAppStore(configureAppStore());
                        }}
                    >
                        <App />
                    </ErrorBoundary>
                </ScopedCssBaseline>
            </ThemeProvider>
        </Provider> */}
        </>
    );
};

export default AppProvidersWrapper;
