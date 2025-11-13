import { Constants } from "./constants";

export class Toasts {

    myConstants!: Constants;

    constructor() {
        this.myConstants = new Constants();
    }

    private toastContainer: string = "<div id=\"_TOAST_ID_\" class=\"toast _TOAST_MODEL_ fade show\" role=\"alert\" aria-live=\"assertive\" aria-atomic=\"true\">_TOAST_BODY_</div>";
    private toastHeader: string = "<div class=\"toast-header\">_TOAST_HEADER_</div>";
    private toastTitle: string = "<strong class=\"mr-auto\">_TOAST_TITLE_</strong><small>_TOAST_SUBTITLE_</small>_TOAST_BUTTON_";
    private toastButton: string = "<button data-dismiss=\"toast\" type=\"button\" class=\"ml-2 mb-1 close\" aria-label=\"Close\" onclick=\"this.closest('.toast').remove()\"><span aria-hidden=\"true\">×</span></button>";
    private toastMessage: string = "<div class=\"toast-body\">_TOAST_MESSAGE_</div>"

    public toastError(thisTitle: string, thisSubtitle: string, thisMessage: string) {
        let myToastId = `toast-${Date.now()}-${Math.random().toString(36).substring(2)}`;
        let myToastButton = this.toastButton;
        let myToastTitle = this.toastTitle.replace('_TOAST_TITLE_',thisTitle).replace('_TOAST_SUBTITLE_',thisSubtitle).replace('_TOAST_BUTTON_', myToastButton);
        let myToastMessage = this.toastMessage.replace('_TOAST_MESSAGE_', thisMessage)
        let myToastHeader = this.toastHeader.replace('_TOAST_HEADER_', myToastTitle)
        let myToastBody = myToastHeader + myToastMessage;
        let myToastContainer = this.toastContainer.replace('_TOAST_ID_', myToastId).replace('_TOAST_MODEL_', "bg-danger").replace('_TOAST_BODY_', myToastBody)
        this.displayToast(myToastContainer, myToastId, this.myConstants.ToastErrorDuration);
    }

    public toastWarning(thisTitle: string, thisSubtitle: string, thisMessage: string) {
        let myToastId = `toast-${Date.now()}-${Math.random().toString(36).substring(2)}`;
        let myToastButton = this.toastButton;
        let myToastTitle = this.toastTitle.replace('_TOAST_TITLE_',thisTitle).replace('_TOAST_SUBTITLE_',thisSubtitle).replace('_TOAST_BUTTON_', myToastButton);
        let myToastMessage = this.toastMessage.replace('_TOAST_MESSAGE_', thisMessage)
        let myToastHeader = this.toastHeader.replace('_TOAST_HEADER_', myToastTitle)
        let myToastBody = myToastHeader + myToastMessage;
        let myToastContainer = this.toastContainer.replace('_TOAST_ID_', myToastId).replace('_TOAST_MODEL_', "bg-warning").replace('_TOAST_BODY_', myToastBody)
        this.displayToast(myToastContainer, myToastId, this.myConstants.ToastWarningDuration);
    }

    public toastInfo(thisTitle: string, thisSubtitle: string, thisMessage: string) {
        let myToastId = `toast-${Date.now()}-${Math.random().toString(36).substring(2)}`;
        let myToastButton = this.toastButton;
        let myToastTitle = this.toastTitle.replace('_TOAST_TITLE_',thisTitle).replace('_TOAST_SUBTITLE_',thisSubtitle).replace('_TOAST_BUTTON_', myToastButton);
        let myToastMessage = this.toastMessage.replace('_TOAST_MESSAGE_', thisMessage)
        let myToastHeader = this.toastHeader.replace('_TOAST_HEADER_', myToastTitle)
        let myToastBody = myToastHeader + myToastMessage;
        let myToastContainer = this.toastContainer.replace('_TOAST_ID_', myToastId).replace('_TOAST_MODEL_', "bg-info").replace('_TOAST_BODY_', myToastBody)
        this.displayToast(myToastContainer, myToastId, this.myConstants.ToastInfoDuration);
    }

    public toastSuccess(thisTitle: string, thisSubtitle: string, thisMessage: string) {
        let myToastId = `toast-${Date.now()}-${Math.random().toString(36).substring(2)}`;
        let myToastButton = this.toastButton;
        let myToastTitle = this.toastTitle.replace('_TOAST_TITLE_',thisTitle).replace('_TOAST_SUBTITLE_',thisSubtitle).replace('_TOAST_BUTTON_', myToastButton);
        let myToastMessage = this.toastMessage.replace('_TOAST_MESSAGE_', thisMessage)
        let myToastHeader = this.toastHeader.replace('_TOAST_HEADER_', myToastTitle)
        let myToastBody = myToastHeader + myToastMessage;
        let myToastContainer = this.toastContainer.replace('_TOAST_ID_', myToastId).replace('_TOAST_MODEL_', "bg-success").replace('_TOAST_BODY_', myToastBody)
        this.displayToast(myToastContainer, myToastId, this.myConstants.ToastSuccessDuration);
    }

    private displayToast(thisToast: string, thisToastId: string, thisToastDuration: number) {
        let toastsContainer = document.getElementById("toastsContainerTopRight");
        if(toastsContainer != null) {
            toastsContainer.insertAdjacentHTML('afterbegin', thisToast);
                setTimeout(() => {
                const toastToRemove = document.getElementById(thisToastId);
                
                if (toastToRemove) {
                    toastToRemove.classList.remove('show'); 
                    setTimeout(() => {
                        toastToRemove.remove();
                    }, 500);
                }
            }, thisToastDuration);
        } else {
            console.log("Toasts container not found.")
        }
    }
}
