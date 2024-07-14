import App from './app';
import { QueryClient, QueryClientProvider } from '@tanstack/solid-query';

const AppProvidersWrapper = () => {
    const client = new QueryClient();
    return (
        <>
            <QueryClientProvider client={client}>
                <App></App>
            </QueryClientProvider>
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
