
sap.ui.define(
    [
        "sap/ui/core/mvc/Controller",
        "sap/ui/core/Fragment"
    ],
    function (BaseController, Fragment) {
        "use strict";

        return BaseController.extend("com.app.parkinglot.controller.Basecontroller", {
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
            loadFragment: async function (sFragmentName) {
                const oFragment = await Fragment.load({
                  id: this.getView().getId(),
                  name: `com.app.parkinglot.fragment.${sFragmentName}`,
                  controller: this
                });
                this.getView().addDependent(oFragment);
                return oFragment
              }
        });
    }
);
