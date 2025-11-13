import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Config } from 'datatables.net';
import { Subject, lastValueFrom } from 'rxjs';
import { Image } from 'src/app/interfaces/image';
import { Images } from 'src/app/models/images.model';
import { K8sService } from 'src/app/services/k8s.service';
import { KubevirtMgrService } from 'src/app/services/kubevirt-mgr.service';
import { Toasts } from 'src/app/classes/toasts';

@Component({
  selector: 'app-images',
  templateUrl: './images.component.html',
  styleUrls: ['./images.component.css']
})
export class ImagesComponent implements OnInit {

    pageName: string = "Images";

    imageList: Images [] = [];
    namespacesList: string[] = [];

    myToasts!: Toasts;

    /*
     * Dynamic Tables
     */
    imgList_dtOptions: Config = {
        //pagingType: 'full_numbers',
        //lengthMenu: [5,10,15,25,50,100,150,200],
        //pageLength: 50,
        paging: false,
        info: false,
        ordering: true,
        orderMulti: true,
        search: true,
        destroy: false,
        stateSave: false,
        serverSide: false,
        columnDefs: [{ orderable: false, targets: 0 }, { orderable: false, targets: 5 }],
        order: [[1, 'asc']],
    };
    imgList_dtTrigger: Subject<any> = new Subject<any>();

    constructor(
        private router: Router,
        private k8sService: K8sService,
        private kubevirtMgrService: KubevirtMgrService
    ) { }

    async ngOnInit(): Promise<void> {
        let navTitle = document.getElementById("nav-title");
        if(navTitle != null) {
            navTitle.replaceChildren(this.pageName);
        }
        this.myToasts = new Toasts();
        await this.getImages();
        this.imgList_dtTrigger.next(null);
        await this.getNamespaces();
    }

    ngOnDestroy() {
        this.imgList_dtTrigger.unsubscribe();
    }

    /*
     * Get the list of Images
     */
    async getImages(): Promise<void> {
        this.imageList = [];
        let currentImage = new Images;
        const data = await lastValueFrom(this.kubevirtMgrService.getImages());
        let images = data.items;
        for (let i = 0; i < images.length; i++) {
            currentImage = new Images();
            currentImage.name = images[i].metadata["name"];
            currentImage.namespace = images[i].metadata["namespace"];
            currentImage.creationTimestamp = new Date(images[i].metadata["creationTimestamp"]);
            currentImage.type = images[i].spec["type"];
            currentImage.readableName = images[i].spec["readableName"];
            this.imageList.push(currentImage);
        }
    }

    /*
     * Create the new image
     */
    async applyNew(name: string, namespace: string, type: string, credentials: string, readableName: string, readableDescription: string, value: string): Promise<void> {
        if(name != "" && namespace != "" && type != "" && readableName != "" && value != "") {
            let myImage: Image = {
                apiVersion: 'kubevirt-manager.io/v1',
                kind: 'Image',
                metadata: {
                    name: name,
                    namespace: namespace
                },
                spec: {
                    type: type,
                    readableName: readableName
                }
            };
            if(credentials != "") {
                myImage.spec.credentials = credentials;
            }
            if(readableDescription != "") {
                myImage.spec.readableDescription = readableDescription;
            }
            switch(type) {
                case "http":
                    let http = { url: value }
                    myImage.spec.http = http;
                    break;
                case "gcs":
                    let gcs = { url: value }
                    myImage.spec.gcs = gcs;
                    break;
                case "s3":
                    let s3 = { url: value }
                    myImage.spec.s3 = s3;
                    break;
                case "registry":
                    let registry = { url: value }
                    myImage.spec.registry = registry;
                    break;
                case "pvc":
                    let pvc = { name: value , namespace: namespace }
                    myImage.spec.pvc = pvc;
                    break;
            }
            if((type == "http") && !value.startsWith("http") || (type == "gcs") && !value.startsWith("gcs://") || (type == "s3") && !value.startsWith("s3://") || (type == "registry") && !value.startsWith("docker://")) {
                alert("Make sure your URL is following the correct format!");
            } else {
                try {
                    const data = await lastValueFrom(this.kubevirtMgrService.createImage(myImage));
                    this.hideComponent("modalnew");
                    this.myToasts.toastSuccess(this.pageName, "", "Created Image: " + name)
                    this.fullReload(); 
                } catch (e: any) {
                    this.myToasts.toastError(this.pageName, "", e.message);
                    console.log(e);
                }
            }
        } else {
            alert("Make sure to fill the required fields: name, type, readableName and value");
        }
    }

    /*
     * Get Namespaces from Kubernetes
     */
    async getNamespaces(): Promise<void> {
        try {
            const data = await lastValueFrom(this.k8sService.getNamespaces());
            let nss = data.items;
            for (let i = 0; i < nss.length; i++) {
            this.namespacesList.push(nss[i].metadata["name"]);
            }
        } catch (e: any) {
            console.log(e);
        }
    }

    /*
     * Show New Window
     */
    showNew(): void {
        let modalDiv = document.getElementById("modal-new");
        let modalTitle = document.getElementById("new-title");
        let selectorNamespacesField = document.getElementById("new-image-namespace");
        if(modalTitle != null) {
            modalTitle.replaceChildren("New Image");
        }

         /* Load Namespace List and Set Selector */
         let nsSelectorOptions = "";
         for (let i = 0; i < this.namespacesList.length; i++) {
             nsSelectorOptions += "<option value=" + this.namespacesList[i] +">" + this.namespacesList[i] + "</option>\n";
         }
         if (selectorNamespacesField != null) {
             selectorNamespacesField.innerHTML = nsSelectorOptions;
         }


        if(modalDiv != null) {
            modalDiv.setAttribute("class", "modal fade show");
            modalDiv.setAttribute("aria-modal", "true");
            modalDiv.setAttribute("role", "dialog");
            modalDiv.setAttribute("aria-hidden", "false");
            modalDiv.setAttribute("style","display: block;");
        }
    }

    /*
     * On Change Image Type
     */
    onChangeImageType(type: string): void {
        let imageValueField = document.getElementById("new-image-value");
        switch(type) {
            case "http":
                imageValueField?.setAttribute("placeholder", "http(s)://example.com/image-file.qcow2.gz")
                break;
            case "gcs":
                imageValueField?.setAttribute("placeholder", "gcs://bucket-name/image-file.qcow2.gz")
                break;
            case "s3":
                imageValueField?.setAttribute("placeholder", "s3://s3.<region>.amazonaws.com/bucket-name/image-file.qcow2.gz")
                break;
            case "registry":
                imageValueField?.setAttribute("placeholder", "docker://repository/image:tag")
                break;
            case "pvc":
                imageValueField?.setAttribute("placeholder", "Name of PVC in the same Namespace selected")
                break;
                
        }
    }

    /*
    * Show Delete Window
    */
    showDelete(imageName: string, imageNamespace: string): void {
        let modalDiv = document.getElementById("modal-delete");
        let modalTitle = document.getElementById("delete-title");
        let modalBody = document.getElementById("delete-value");
        if(modalTitle != null) {
            modalTitle.replaceChildren("Delete");
        }
        if(modalBody != null) {
            let imageNameInput = document.getElementById("delete-name");
            let imageNamespaceInput = document.getElementById("delete-namespace");
            if(imageNameInput != null && imageNamespaceInput != null) {
                imageNameInput.setAttribute("value", imageName);
                imageNamespaceInput.setAttribute("value", imageNamespace);
                modalBody.replaceChildren("Are you sure you want to delete " + imageNamespace + " - " + imageName + "?");
            }
        }
        if(modalDiv != null) {
            modalDiv.setAttribute("class", "modal fade show");
            modalDiv.setAttribute("aria-modal", "true");
            modalDiv.setAttribute("role", "dialog");
            modalDiv.setAttribute("aria-hidden", "false");
            modalDiv.setAttribute("style","display: block;");
        }
    }

    /*
     * Delete image
     */
    async applyDelete(): Promise<void> {
        let imageNameField = document.getElementById("delete-name");
        let imageNamespaceField = document.getElementById("delete-namespace");
        if(imageNameField != null && imageNamespaceField != null) {
            let imageNamespace = imageNamespaceField.getAttribute("value");
            let imageName = imageNameField.getAttribute("value");
            if(imageName != null && imageNamespace != null) {
                try {
                    let deleteImage = await lastValueFrom(this.kubevirtMgrService.deleteImage(imageNamespace, imageName));
                    this.hideComponent("modal-delete");
                    this.myToasts.toastSuccess(this.pageName, "", "Deleted Image: " + imageName);
                    this.fullReload();
                } catch (e: any) {
                    this.myToasts.toastError(this.pageName, "", e.message);
                    console.log(e);
                }
            }
        }
    }

    /*
     * Show Info Window
     */
    async showInfo(name: string, namespace: string): Promise<void> {
        let myInnerHTML = "";
        let imageData = await lastValueFrom(this.kubevirtMgrService.getImage(namespace, name));
        myInnerHTML += "<li class=\"nav-item\">Name: <span class=\"float-right badge bg-primary\">" + imageData.metadata["name"] + "</span></li>";
        myInnerHTML += "<li class=\"nav-item\">Namespace: <span class=\"float-right badge bg-primary\">" + imageData.metadata["namespace"] + "</span></li>";
        myInnerHTML += "<li class=\"nav-item\">Creation Time: <span class=\"float-right badge bg-primary\">" + new Date(imageData.metadata["creationTimestamp"]) + "</span></li>";
        myInnerHTML += "<br />"
        myInnerHTML += "<li class=\"nav-item\">Readable Name: <span class=\"float-right badge bg-primary\">" + imageData.spec["readableName"] + "</span></li>";
        if(imageData.spec["readableDescription"] != null && imageData.spec["readableDescription"] != "") {
            myInnerHTML += "<li class=\"nav-item\">Description: <span class=\"float-right badge bg-primary\">" + imageData.spec["readableDescription"] + "</span></li>";
        }
        switch(imageData.spec["type"]) {
            case "http":
                myInnerHTML += "<li class=\"nav-item\">Type: <span class=\"float-right badge bg-primary\">" + imageData.spec["type"] + "</span></li>";
                myInnerHTML += "<li class=\"nav-item\">URL: <span class=\"float-right badge bg-primary\">" + imageData.spec.http["url"] + "</span></li>";
                break;
            case "gcs":
                myInnerHTML += "<li class=\"nav-item\">Type: <span class=\"float-right badge bg-primary\">" + imageData.spec["type"] + "</span></li>";
                myInnerHTML += "<li class=\"nav-item\">URL: <span class=\"float-right badge bg-primary\">" + imageData.spec.gcs["url"] + "</span></li>";
                break;
            case "s3":
                myInnerHTML += "<li class=\"nav-item\">Type: <span class=\"float-right badge bg-primary\">" + imageData.spec["type"] + "</span></li>";
                myInnerHTML += "<li class=\"nav-item\">URL: <span class=\"float-right badge bg-primary\">" + imageData.spec.s3["url"] + "</span></li>";
                break;
            case "registry":
                myInnerHTML += "<li class=\"nav-item\">Type: <span class=\"float-right badge bg-primary\">" + imageData.spec["type"] + "</span></li>";
                myInnerHTML += "<li class=\"nav-item\">URL: <span class=\"float-right badge bg-primary\">" + imageData.spec.registry["url"] + "</span></li>";
                break;
            case "pvc":
                myInnerHTML += "<li class=\"nav-item\">Type: <span class=\"float-right badge bg-primary\">" + imageData.spec["type"] + "</span></li>";
                myInnerHTML += "<li class=\"nav-item\">PVC Name: <span class=\"float-right badge bg-primary\">" + imageData.spec.pvc["name"] + "</span></li>";
                myInnerHTML += "<li class=\"nav-item\">PVC Namespace: <span class=\"float-right badge bg-primary\">" + imageData.spec.pvc["namespace"] + "</span></li>";
                break;
                
        }
        
        let modalDiv = document.getElementById("modal-info");
        let modalTitle = document.getElementById("info-title");
        let modalBody = document.getElementById("info-cards");
        if(modalTitle != null) {
            modalTitle.replaceChildren("Image: " + namespace + " - " + name);
        }
        if(modalBody != null) {
            modalBody.innerHTML = myInnerHTML;
        }
        if(modalDiv != null) {
            modalDiv.setAttribute("class", "modal fade show");
            modalDiv.setAttribute("aria-modal", "true");
            modalDiv.setAttribute("role", "dialog");
            modalDiv.setAttribute("aria-hidden", "false");
            modalDiv.setAttribute("style","display: block;");
        }
    }

    /*
     * Show Edit Window
     */
    async showEdit(name: string, namespace: string): Promise<void> {
        let imageData = await lastValueFrom(this.kubevirtMgrService.getImage(namespace, name));
        let myImageType = imageData.spec["type"];
        let myImageValue = "";
        switch(myImageType) {
            case "http":
                myImageValue = imageData.spec.http["url"] 
                break;
            case "gcs":
                myImageValue = imageData.spec.gcs["url"];
                break;
            case "s3":
                myImageValue = imageData.spec.s3["url"];
                break;
            case "registry":
                myImageValue = imageData.spec.registry["url"];
                break;
            case "pvc":
                myImageValue = imageData.spec.pvc["name"];
                break;
                
        }
        let modalDiv = document.getElementById("modal-edit");
        let modalTitle = document.getElementById("edit-title");
        let modalBody = document.getElementById("edit-value");
        if(modalTitle != null) {
            modalTitle.replaceChildren("Edit: " + namespace + " - " + name);
        }
        if(modalBody != null) {
            let imageName = document.getElementById("image-name");
            let imageNamespace = document.getElementById("image-namespace");
            let imageType = document.getElementById("image-type");
            if (imageName != null && imageNamespace != null && imageType != null) {
                imageName.setAttribute("value", name);
                imageNamespace.setAttribute("value", namespace);
                imageType.setAttribute("value", myImageType);
            }
            let imageReadableName = document.getElementById("image-readable-name");
            let imageDescription = document.getElementById("image-description");
            let imageValue = document.getElementById("image-value");
            if (imageReadableName != null) {
                imageReadableName.setAttribute("value", imageData.spec["readableName"]);
                imageReadableName.setAttribute("placeholder", imageData.spec["readableName"]);
            }
            if (imageDescription != null) {
                imageDescription.setAttribute("value", imageData.spec["readableDescription"]);
                imageDescription.setAttribute("placeholder", imageData.spec["readableDescription"]);
            }
            if (imageValue != null) {
                imageValue.setAttribute("value", myImageValue);
                imageValue.setAttribute("placeholder", myImageValue);
            }
        }
        if(modalDiv != null) {
            modalDiv.setAttribute("class", "modal fade show");
            modalDiv.setAttribute("aria-modal", "true");
            modalDiv.setAttribute("role", "dialog");
            modalDiv.setAttribute("aria-hidden", "false");
            modalDiv.setAttribute("style","display: block;");
        }
    }

    /*
     * Perform Edit
     */
    async applyEdit(readableName: string, readableDescription: string, value: string): Promise<void> {
        let nameField = document.getElementById("image-name");
        let namespaceField = document.getElementById("image-namespace");
        let typeField = document.getElementById("image-type");
        if(readableName != null && readableDescription != null && nameField != null && namespaceField != null && typeField != null) {
            let imageName = nameField.getAttribute("value");
            let imageNamespace = namespaceField.getAttribute("value");
            let imageType = typeField.getAttribute("value");
            if(imageName != null && imageNamespace != null && imageType != null) {
                let myImage: Image = {
                    apiVersion: 'kubevirt-manager.io/v1',
                    kind: 'Image',
                    metadata: {
                        name: imageName,
                        namespace: imageNamespace
                    },
                    spec: {
                        type: imageType,
                        readableName: readableName
                    }
                };
                switch(imageType) {
                    case "http":
                        let http = { url: value }
                        myImage.spec.http = http;
                        break;
                    case "gcs":
                        let gcs = { url: value }
                        myImage.spec.gcs = gcs;
                        break;
                    case "s3":
                        let s3 = { url: value }
                        myImage.spec.s3 = s3;
                        break;
                    case "registry":
                        let registry = { url: value }
                        myImage.spec.registry = registry;
                        break;
                    case "pvc":
                        let pvc = { name: value , namespace: imageNamespace }
                        myImage.spec.pvc = pvc;
                        break;
                        
                }
                if (readableDescription != "") {
                    myImage.spec.readableDescription = readableDescription;
                }
                try {
                    const data = await lastValueFrom(this.kubevirtMgrService.editImage(myImage));
                    this.hideComponent("modaledit");
                    this.myToasts.toastSuccess(this.pageName, "", "Edited Image: " + imageName);
                    this.fullReload();
                } catch (e: any) {
                    this.myToasts.toastError(this.pageName, "", e.message);
                    console.log(e);
                }
            }
        }
    }

    /*
     * Hide Component
     */
    hideComponent(divId: string): void {
        let modalDiv = document.getElementById(divId);
        if(modalDiv != null) {
            modalDiv.setAttribute("class", "modal fade");
            modalDiv.setAttribute("aria-modal", "false");
            modalDiv.setAttribute("role", "");
            modalDiv.setAttribute("aria-hidden", "true");
            modalDiv.setAttribute("style","display: none;");
        }
    }

    /*
     * full reload
     */
    fullReload(): void {
        this.router.navigateByUrl('/refresh',{skipLocationChange:true}).then(()=>{
            this.router.navigate([`/imagelist`]);
        })
    }

}
