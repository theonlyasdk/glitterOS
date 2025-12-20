export function Dialog({ id, title, body, footer }) {
  return (
    <>
      <div 
        className="modal fade" 
        id={id} 
        tabIndex={-1} 
        aria-labelledby={`${id}Label`} 
        aria-hidden="true"
        data-bs-keyboard="false" data-bs-backdrop="static"
      >
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header wm-win-header" id={`${id}-header`}>
              <h5 className="modal-title" id={`${id}Label`}>{title}</h5>
              <button 
                type="button" 
                className="btn-close" 
                data-bs-dismiss="modal" 
                aria-label="Close"
              ></button>
            </div>
            <div className="modal-body">
              {body}
            </div>
            {footer && (
              <div className="modal-footer wm-win-footer">
                {footer}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}