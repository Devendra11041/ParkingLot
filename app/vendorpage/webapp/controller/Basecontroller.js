
sap.ui.define(
    [
        "sap/ui/core/mvc/Controller",
        "sap/ui/core/Fragment"
    ],
    function (BaseController, Fragment) {
        "use strict";

        return BaseController.extend("com.app.vendorpage.controller.Basecontroller", {
            onInit: function () {

            },
            //Performing curd operations
            createData: function (oModel, oPayload, sPath) {
                debugger
                return new Promise((resolve, reject) => {
                    oModel.create(sPath, oPayload, {
                        refreshAfterChange: true,
                        success: function (oSuccessData) {
                            resolve(oSuccessData);
                        },
                        error: function (oErrorData) {
                            reject(oErrorData)
                        }
                    })
                })
            },
            deleteData: function (oModel, sPath, ID) {
                return new Promise((resolve, reject) => {
                    oModel.remove(`${sPath}/${ID}`, {
                        success: function (oSuccessData) {
                            resolve(oSuccessData);
                        },
                        error: function (oErrorData) {
                            reject(oErrorData)
                        }
                    })
                })
            },
        });
    }
);
