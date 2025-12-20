export function DialogTrigger({triggerFor,content}) {
    return <>
    <button type="button" data-bs-toggle="modal" data-bs-target={`#${triggerFor}`}>
        {content}
    </button>
    </>
}
