import { FC, createContext, useContext, useEffect, useRef, useState } from "react";
import { useSwapDataState, useSwapDataUpdate } from "../../../context/swap";
import { StripeOnramp, loadStripeOnramp } from "@stripe/crypto";
import { PublishedSwapTransactionStatus } from "../../../lib/layerSwapApiClient";

const FiatTransfer: FC = () => {
    const { swap } = useSwapDataState()
    const stripeSessionId = swap?.metadata?.['STRIPE:SessionId']
    const stripeOnrampPromise = loadStripeOnramp(process.env.NEXT_PUBLIC_STRIPE_SECRET);

    return <div className='rounded-md bg-secondary-700 border border-secondary-500 divide-y divide-secondary-500'>
        <CryptoElements stripeOnramp={stripeOnrampPromise}>
            <OnrampElement clientSecret={stripeSessionId} swapId={swap?.id} />
        </CryptoElements>
    </div>
}

const CryptoElementsContext = createContext(null);

export const CryptoElements: FC<{ stripeOnramp: Promise<StripeOnramp> }> = ({
    stripeOnramp,
    children
}) => {
    const [ctx, setContext] = useState<{ onramp: StripeOnramp }>(() => ({ onramp: null }));
    useEffect(() => {
        let isMounted = true;

        Promise.resolve(stripeOnramp).then((onramp) => {
            if (onramp && isMounted) {
                setContext((ctx) => (ctx.onramp ? ctx : { onramp }));
            }
        });

        return () => {
            isMounted = false;
        };
    }, [stripeOnramp]);

    return (
        <CryptoElementsContext.Provider value={ctx}>
            {children}
        </CryptoElementsContext.Provider>
    );
};

// React hook to get StripeOnramp from context
export const useStripeOnramp = () => {
    const context = useContext<{ onramp: StripeOnramp }>(CryptoElementsContext);
    return context?.onramp;
};
type OnrampElementProps = {
    clientSecret: string,
    swapId: string,
}
// React element to render Onramp UI
export const OnrampElement: FC<OnrampElementProps> = ({
    clientSecret,
    swapId
}) => {
    const stripeOnramp = useStripeOnramp();
    const onrampElementRef = useRef(null);
    const { setSwapPublishedTx } = useSwapDataUpdate()
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        const containerRef = onrampElementRef.current;
        if (containerRef) {
            containerRef.innerHTML = '';
            if (clientSecret && stripeOnramp && swapId) {
                setLoading(true)
                const session = stripeOnramp
                    .createSession({
                        clientSecret,
                        appearance: {
                            theme: "dark"
                        },
                    })
                    .mount(containerRef)
                const eventListener = async (e) => {
                    let transactionStatus: PublishedSwapTransactionStatus
                    if (e.payload.session.status === "fulfillment_complete")
                        transactionStatus = PublishedSwapTransactionStatus.Completed
                    else if (e.payload.session.status === "fulfillment_processing")
                        transactionStatus = PublishedSwapTransactionStatus.Pending
                    else {
                        // TODO handle
                        return
                    }
                    await setSwapPublishedTx(swapId, PublishedSwapTransactionStatus.Completed, e.payload.session.id);
                }

                session.addEventListener("onramp_session_updated", eventListener)
                session.addEventListener("onramp_ui_loaded", () => setLoading(false))
            }
        }

    }, [clientSecret, stripeOnramp, swapId]);

    return <div className="relative">
        {
            loading &&
            <Skeleton />
        }
        <div ref={onrampElementRef} ></div>
    </div>;
};


const Skeleton: FC = () => {
    return <div className="absolute pt-10 top-0 left-0 right-0 bottom-0 w-full overflow-hidden flex flex-col items-center justify-between">
        <div className="animate-pulse flex flex-col items-center justify-between w-full">
            <div className="rounded-md p-4 max-w-sm w-full mx-auto">
                <div className="animate-pulse flex space-x-4">
                    <div className="rounded-md bg-slate-700 h-6 w-6"></div>
                    <div className="space-y-2">
                        <div className="h-2 w-12 bg-slate-700 rounded"></div>
                        <div className="h-2 w-40 bg-slate-700 rounded"></div>
                    </div>
                </div>
            </div>
            <div className="border border-slate-700 grid grid-rows-2 gap-2 rounded-t-md p-4 max-w-sm w-full mx-auto">
                <div className="grid grid-cols-8 gap-4">
                    <div className="h-2 bg-slate-700 rounded"></div>
                </div>
                <div className="grid grid-cols-8 gap-4">
                    <div className="h-6 bg-slate-700 rounded col-span-2"></div>
                    <div className="h-4 col-start-6 bg-slate-700 rounded"></div>
                    <div className="h-4  bg-slate-700 rounded"></div>
                    <div className="h-4  bg-slate-700 rounded"></div>
                </div>
            </div>
            <div className="grid grid-rows-3 gap-2 rounded-md p-4 max-w-sm w-full mx-auto">
                <div className="grid grid-cols-8 gap-4">
                    <div className="h-2 bg-slate-700 rounded col-span-2"></div>
                </div>
                <div className="grid grid-cols-8 gap-4">
                    <div className="h-6 bg-slate-700 rounded col-span-2"></div>
                    <div className="h-4 col-start-6 col-span-3 bg-slate-700 rounded"></div>
                </div>
                <div className="grid grid-cols-7 gap-4">
                    <div className="h-2 bg-slate-700 rounded"></div>
                    <div className="h-2 bg-slate-700 rounded"></div>
                </div>
            </div>
            <div className="rounded-md p-4 max-w-sm w-full mx-auto">
                <div className="animate-pulse flex justify-between space-x-4">
                    <div className="space-y-2">
                        <div className="h-2 w-10 bg-slate-700 rounded"></div>
                        <div className="h-2 w-6 bg-slate-700 rounded"></div>
                    </div>
                    <div className="space-y-2">
                        <div className="h-2 w-8 bg-slate-700 rounded"></div>
                        <div className="h-2 w-8 bg-slate-700 rounded"></div>
                    </div>
                </div>
            </div>
        </div>
        <div className="animate-pulse grid rounded-md p-4 max-w-sm w-full mx-auto">
            <div className="h-10 bg-slate-700 rounded col-span-2"></div>
        </div>
    </div>
}

export default FiatTransfer