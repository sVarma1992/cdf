/*!
 * Copyright 2002 - 2014 Webdetails, a Pentaho company.  All rights reserved.
 *
 * This software was developed by Webdetails and is provided under the terms
 * of the Mozilla Public License, Version 2.0, or any later version. You may not use
 * this file except in compliance with the license. If you need a copy of the license,
 * please go to  http://mozilla.org/MPL/2.0/. The Initial Developer is Webdetails.
 *
 * Software distributed under the Mozilla Public License is distributed on an "AS IS"
 * basis, WITHOUT WARRANTY OF ANY KIND, either express or  implied. Please refer to
 * the license for the specific language governing your rights and limitations.
 */


/**
 * A module representing an extension to Dashboard class for handling legacy calls.
 * The methods here handle calling xactions and other legacy related actions
 * All the methods in this module are deprecated
 * @module Dashboard.legacy
 */

define(['../queries/CdaQuery.ext', '../components/XactionComponent.ext', './Dashboard.ext', './Dashboard', '../Logger', '../lib/jquery'],
  function(CdaQueryExt, XactionComponentExt, DashboardExt, Dashboard, Logger, $) {

  Dashboard.implement({

    callPentahoAction : function(obj, solution, path, action, parameters, callback) {
      var myself = this;
    
      // Encapsulate pentahoAction call
      // Dashboards.log("Calling pentahoAction for " + obj.type + " " + obj.name + "; Is it visible?: " + obj.visible);
      if(typeof callback == 'function') {
        return myself.pentahoAction( solution, path, action, parameters, function(json) {
          callback(myself.parseXActionResult(obj,json));
        });
      } else {
        return myself.parseXActionResult(obj,myself.pentahoAction(solution, path, action, parameters, callback));
      }
    },
    
    urlAction : function(url, params, func) {
      return this.executeAjax('xml', url, params, func);
    },
    
    executeAjax : function(returnType, url, params, func) {
      var myself = this;
      // execute a url
      if(typeof func == "function") {
        // async
        return $.ajax({
          url: url,
          type: "POST",
          traditional: true,
          dataType: returnType,
          async: true,
          data: params,
          complete: function(XMLHttpRequest, textStatus) {
            /* CDF-271 jQuery 1.9.1 bug #13388 */
            if(typeof XMLHttpRequest.responseXML == "undefined") {
              func($.parseXML(XMLHttpRequest.responseText));
            } else {
              func(XMLHttpRequest.responseXML);
            }
          },
          error: function(XMLHttpRequest, textStatus, errorThrown) {
            Logger.log("Found error: " + XMLHttpRequest + " - " + textStatus + ", Error: " +  errorThrown,"error");
          }
        });
      }
    
      // Sync
      var result = $.ajax({
        url: url,
        type: "POST",
        dataType:returnType,
        async: false,
        data: params,
        error: function(XMLHttpRequest, textStatus, errorThrown) {
          Logger.log("Found error: " + XMLHttpRequest + " - " + textStatus + ", Error: " +  errorThrown,"error");
        }
    
      });
      if(returnType == 'xml') {
        /* CDF-271 jQuery 1.9.1 bug #13388 */
        if(typeof result.responseXML == "undefined") {
          return $.parseXML(result.responseText);
        } else {
          return result.responseXML;
        }
      } else {
        return result.responseText;
      }
    
    },
    
    pentahoAction : function(solution, path, action, params, func) {
      return this.pentahoServiceAction('ServiceAction', 'xml', solution, path, action, params, func);
    },
    
    pentahoServiceAction : function(serviceMethod, returntype, solution, path, action, params, func) {
      // execute an Action Sequence on the server
    
      var arr = DashboardExt.getServiceAction(serviceMethod, solution, path , action);
      var url = arr.url;
      delete arr.url;
    
      $.each(params,function(i, val) {
        arr[val[0]] = val[1];
      });
      return this.executeAjax(returntype, url, arr, func);
    },
    
    CDF_ERROR_DIV : 'cdfErrorDiv',
    
    createAndCleanErrorDiv : function() {
      if($("#" + this.CDF_ERROR_DIV).length == 0) {
        $("body").append("<div id='" +  this.CDF_ERROR_DIV + "'></div>");
      }
      $("#" + this.CDF_ERROR_DIV).empty();
    },
    
    showErrorTooltip : function() {
      $(function(){
        if($.tooltip) {
          $(".cdf_error").tooltip({
            delay:0,
            track: true,
            fade: 250,
            showBody: " -- "
          });
        }
      });
    },
    
    parseXActionResult : function(obj,html) {
    
      var jXML = $(html);
      var error = jXML.find("SOAP-ENV\\:Fault");
      if(error.length == 0) {
        return jXML;
      }
    
      // error found. Parsing it
      var errorMessage = "Error executing component " + obj.name;
      var errorDetails = new Array();
      errorDetails[0] = " Error details for component execution " + obj.name + " -- ";
      errorDetails[1] = error.find("SOAP-ENV\\:faultstring").find("SOAP-ENV\\:Text:eq(0)").text();
      error.find("SOAP-ENV\\:Detail").find("message").each(function(){
        errorDetails.push($(this).text())
      });
      if(errorDetails.length > 8) {
        errorDetails = errorDetails.slice(0,7);
        errorDetails.push("...");
      }
      //<img src='"+ ERROR_IMAGE + "'>
      // TODO errorDetails in title: is this right?
      var out = "<table class='errorMessageTable' border='0'><tr><td class='errorIcon'></td><td><span class='cdf_error' title=\"" + errorDetails.join('<br/>').replace(/"/g,"'") +"\" >" + errorMessage + " </span></td></tr></table/>";
    
      // if this is a hidden component, we'll place this in the error div
      if(obj.visible == false) {
        $("#" + this.CDF_ERROR_DIV).append("<br />" + out);
      } else{
        $('#'+obj.htmlObject).html(out);
      }
    
      return null;
    
    },
    
    setSettingsValue : function(name,object) {
    
      var data = {
        method: "set",
        key: name,
        value: JSON.stringify(object)
      };
      $.post(DashboardExt.getSettings("set", null), data, function(){});
    },
    
    getSettingsValue : function(key,value) {
    
      var callback = typeof value == 'function' ? value : function(json) {
        value = json;
      };
    
      $.getJSON(DashboardExt.getSettings("get", key), callback);
    },
    
    fetchData : function(cd, params, callback) {
      Logger.log('Dashboards.fetchData() is deprecated. Use Query objects instead','warn');
      // Detect and handle CDA data sources
      if(cd != undefined && cd.dataAccessId != undefined) {
        for(var param in params) {
          cd['param' + params[param][0]] = this.getParameterValue(params[param][1]);
        }
    
        $.post(CdaQueryExt.getDoQuery(), cd,
          function(json) {
            callback(json);
          },'json').error(this.handleServerError);
      }
      // When we're not working with a CDA data source, we default to using jtable to fetch the data...
      else if(cd != undefined) {
    
        var xactionFile = (cd.queryType == 'cda') ? "jtable-cda.xaction" : "jtable.xaction";
    
        $.post(XactionComponentExt.getCdfXaction("pentaho-cdf/actions", xactionFile), cd,
          function(result) {
            callback(result.values);
          },'json');
      }
      // ... or just call the callback when no valid definition is passed
      else {
        callback([]);
      }
    }

  });

});
