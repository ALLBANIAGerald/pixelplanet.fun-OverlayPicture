import { createEffect, createMemo, createSignal, onCleanup, onMount } from 'solid-js';
import accepts from 'attr-accept';

function createDropzone<T extends HTMLElement = HTMLElement>(options?: { accepts: string | string[]; onDrop: (files: File[]) => void }) {
    let ref: T | undefined = undefined;

    const setRef = (r: T) => {
        ref = r;
    };

    const [counter, setCounter] = createSignal(0);

    const [acceptedItemsHovered, setAcceptedItemsHovered] = createSignal(false);

    const onDragEnter = (event: DragEvent) => {
        if (event.currentTarget !== ref) return;
        setCounter((c) => c + 1);
        if (!acceptedItemsHovered()) {
            const items = event.dataTransfer?.items;
            if (!items) return;
            const itemsArr = Array.from(items);
            const acceptedItems = itemsArr.filter((item) => accepts({ type: item.type }, options?.accepts ?? '*'));
            setAcceptedItemsHovered(acceptedItems.length > 0);
        }
    };
    const onDragLeave = (event: DragEvent) => {
        if (event.currentTarget !== ref) return;
        setCounter((c) => c - 1);
    };

    createEffect(() => {
        if (counter() <= 0) setAcceptedItemsHovered(false);
    });

    const onDrop = (event: DragEvent) => {
        event.preventDefault();
        setCounter(0);
        options?.onDrop(Array.from(event.dataTransfer?.files ?? []).filter((item) => accepts({ type: item.type }, options.accepts)));
    };

    const onDragOver = (event: DragEvent) => {
        event.preventDefault();
    };

    onMount(() => {
        if (!ref) return;
        ref.addEventListener('dragenter', onDragEnter);
        ref.addEventListener('dragleave', onDragLeave);
        ref.addEventListener('drop', onDrop);
        ref.addEventListener('dragover', onDragOver);

        onCleanup(() => {
            if (!ref) return;
            ref.removeEventListener('dragenter', onDragEnter);
            ref.removeEventListener('dragleave', onDragLeave);
            ref.removeEventListener('drop', onDrop);
            ref.removeEventListener('dragover', onDragOver);
        });
    });

    return {
        setRef,
        isHovering: createMemo(() => counter() > 0),
        acceptedItemsHovered,
    };
}

export { createDropzone };
