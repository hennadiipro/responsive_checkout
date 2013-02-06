// ---------------------------------------------------------------------
// -- app ---
// ---------------------------------------------------------------------
// keep in mind that this is javascript.  why do I have these particular methods in my app?
// because I want them there.  I name them whatever I want.  There is no 'class' blueprint in javascript, so this
// object is defined AND created right here.
var app = {
  models: {},  // The M in MVC
  collections: {},  // Also the M in MVC, just collections of them.
  views: {},  // The V in MVC
  templates: [],
  zombieHunters: {}, // extensions that clean up event binding to avoid zombie event handlers
  commonFunctions: {}, // functions that are used in numerous places
  // the router is kind-of the C in MVC, but not in the traditional sense.  It's more of a helper controller,
  // which takes a look at the url (and fragments), and does additional things based on what it is.
  // the router is created during document.ready
  router: null,
  data: {} // this will hold *instances* of collections and models.  This is actual data, not definitions
};


// ---------------------------------------------------------------------
// -- templates ---
// ---------------------------------------------------------------------
app.templates.items = Handlebars.compile(jQuery('#items_template').html());
app.templates.item = Handlebars.compile(jQuery('#item_template').html());
app.templates.subtotal = Handlebars.compile(jQuery('#subtotal_template').html());
app.templates.shipping = Handlebars.compile(jQuery('#shipping_template').html());
app.templates.summary = Handlebars.compile(jQuery('#summary_template').html());
app.templates.shipto = Handlebars.compile(jQuery('#shipto_adddress_template').html());
app.templates.billto = Handlebars.compile(jQuery('#billto_address_template').html());
app.templates.payment = Handlebars.compile(jQuery('#payment_template').html());
app.templates.google = Handlebars.compile(jQuery('#google_template').html());
app.templates.paypal = Handlebars.compile(jQuery('#paypal_template').html());
app.templates.total = Handlebars.compile(jQuery('#total_template').html());
app.templates.coupons = Handlebars.compile(jQuery('#coupons_template').html());
app.templates.giftCertificate = Handlebars.compile(jQuery('#gift_certificate_template').html());


// ---------------------------------------------------------------------
// --- zombie hunters
// ---------------------------------------------------------------------
//app.zombieHunters.cartView = createAppView('contentPane');
//app.zombieHunters.subtotalView = createAppView('subtotalPane');
//app.zombieHunters.shippingView = createAppView('shippingPane');
//app.zombieHunters.buysafeView = createAppView('buysafePane');
//app.zombieHunters.shiptoView = createAppView('shiptoPane');
//app.zombieHunters.billtoView = createAppView('billtoPane');
//app.zombieHunters.paymentView = createAppView('paymentPane');
//app.zombieHunters.totalView = createAppView('totalPane');

// Note:  We're not using zombie hunters for this checkout.  None of the views get destroyed. Some hidden, but none destroyed.


// ---------------------------------------------------------------------
// --- common functions
// ---------------------------------------------------------------------
app.commonFunctions.enablePleaseWaitMessage = function () {
  jQuery(document).ready(function () {
    jQuery('body').append("<div class='PW_outer'><div class='PW_inner'>Communicating with Server...<br /><img src='/js/jquery.smallhbar.indicator.gif' alt='please wait'/></div></div>");
    jQuery('.PW_inner').hide();
    jQuery(document).ajaxStart(
            function () {
              jQuery('.PW_inner').show();
            }).ajaxStop(function () {
              jQuery('.PW_inner').hide();
            });
  });
};


app.commonFunctions.displayCheckoutErrors = function (errors) {
  var html = '<ul>';
  _.each(errors, function (error) {
    html += '<li>' + error + '</li>';
  });
  html += '</ul>';

  jQuery('#checkoutError').removeClass('hidden').find('.errorContent').html(html).removeClass('hidden');
//  var div = document.getElementById('checkoutError');
//  if (div) {
//    div.scrollIntoView();
//  }

};

app.commonFunctions.clearCheckoutErrors = function () {
  jQuery('#checkoutError').addClass('hidden').find('.errorContent').html('').addClass('hidden');

};


app.commonFunctions.blockUserInput = function () {
  // quick check for a background.
  if (document.getElementById('MB_overlay') == null) {
    var bgDiv = document.createElement('div');
    bgDiv.id = 'MB_overlay';
    document.body.appendChild(bgDiv);
  }

  var bg = jQuery("#MB_overlay");
  bg.css({"opacity": "0.5"});
  bg.show(); //.fadeIn("0");
};

app.commonFunctions.endBlockUserInput = function () {
  jQuery("#MB_overlay").hide();
};


app.commonFunctions.checkout = function (paymentMethod) {

  if (!app.data.bootstrap.get('processingOrder')) {
    app.data.bootstrap.set({'processingOrder': true});
    app.commonFunctions.blockUserInput();

    app.data.cart.set({'paymentMethod': paymentMethod});

    app.commonFunctions.clearCheckoutErrors();

    var button = jQuery('#btnFinalize');
    var buttonHtml = button.html();
    button.html("<img src='images/loader.gif' alt='please wait' />");

    // Notice: The checkout call does not take a cart.  It takes a CheckoutRequest which contains a cart.
    // Since the checkout process hands of to UltraCart to handle upsells, etc., we must also provide the
    // return point.
    var checkoutRequest = {
      'cart': app.data.cart.attributes,
      errorParameterName: 'error', // if there are errors after the handoff, the redirect page will receive those errors using this http parameter
      errorReturnUrl: document.URL, // this same page.
      secureHostName: (window.serverName || null) // can be null.  defaults to secure.ultracart.com if null.  could also be www.mystore.com if that was your url.
      // the secureHostName is where the checkout finishes on (receipt).  many merchants have dozens of sites.  So, if this isn't secure.ultracart and
      // you have more than one, you must specify it.
    };

    jQuery.ajax({
      url: restUrl + '/checkout', // restUrl is defined in the html page.
      type: 'POST', // Notice
      headers: { "cache-control": "no-cache" },
      contentType: 'application/json; charset=UTF-8',
      data: JSON.stringify(checkoutRequest),
      dataType: 'json'
    }).done(function (checkoutResponse) {
              if (checkoutResponse && checkoutResponse.redirectToUrl) {
                location.href = checkoutResponse.redirectToUrl;
              } else {
                if (checkoutResponse.errors && checkoutResponse.errors.length) {
                  app.commonFunctions.displayCheckoutErrors(checkoutResponse.errors);
                }
              }
            }).always(function () {
              button.html(buttonHtml);
              app.data.bootstrap.set({'processingOrder': false});
              app.commonFunctions.endBlockUserInput();
            });
  }

};

app.commonFunctions.showHideBilling = function (show, update) {
  // if show is not defined, then determine if the billing should be shown by comparing the carts.
  // after determining, update the check box as well.  this needs to be done on page load to sync
  // the check box with any existing cart.

  var attr = null;

  if (show === 'undefined') {

    var theyAreTheSame = true;  // if there is no cart, the fields should be hidden by default.
    if (app.data.cart) {
      attr = app.data.cart.attributes; // quicker to hit attributes than multiple cart.get() calls.
      theyAreTheSame =
              (attr.shipToFirstName == attr.billToFirstName) &&
                      (attr.shipToFirstName == attr.billToFirstName) &&
                      (attr.shipToLastName == attr.billToLastName) &&
                      (attr.shipToFirstName == attr.billToFirstName) &&
                      (attr.shipToCompany == attr.billToCompany) &&
                      (attr.shipToAddress1 == attr.billToAddress1) &&
                      (attr.shipToAddress2 == attr.billToAddress2) &&
                      (attr.shipToCity == attr.billToCity) &&
                      (attr.shipToState == attr.billToState) &&
                      (attr.shipToCountry == attr.billToCountry);
    }

    app.commonFunctions.showHideBilling(!theyAreTheSame, false);

  } else {
    var billingInfo = jQuery('.billingInfo');
    if (show) {
      billingInfo.removeClass('hidden');
    } else {
      billingInfo.addClass('hidden');
      if (update) {
        attr = app.data.cart.attributes;
        app.data.cart.set({
          'billToLastName': attr.shipToLastName,
          'billToFirstName': attr.shipToFirstName,
          'billToCompany': attr.shipToCompany,
          'billToAddress1': attr.shipToAddress1,
          'billToAddress2': attr.shipToAddress2,
          'billToCity': attr.shipToCity,
          'billToState': attr.shipToState,
          'billToCountry': attr.shipToCountry
        }, {silent: true});
        app.data.cart.trigger('addressCopy');
      }
    }

  }
};


app.commonFunctions.displayServerErrors = function () {
  var errors = [];
  var searchString = window.location.search.substring(1), params = searchString.split("&");
  for (var i = 0; i < params.length; i++) {
    var val = params[i].split("=");
    if (val[0] == 'error') {
      errors.push(decodeURIComponent(val[1]));
    }
  }
  if (errors.length) {
    app.commonFunctions.displayCheckoutErrors(errors);
  }
};


app.commonFunctions.estimateShipping = function () {
  if (!app.data.bootstrap.get('fetchingShipping')) {
    app.data.bootstrap.set({'fetchingShipping': true});

    jQuery.ajax({
      url: restUrl + '/estimateShipping', // restUrl is defined in the html page.
      type: 'POST',
      async: true,
      'contentType': 'application/json; charset=UTF-8',
      data: JSON.stringify(app.data.cart.toJSON()),
      dataType: 'json'
    }).done(
            function (shippingEstimates) {
              if (shippingEstimates) {
                if (shippingEstimates.length) {

                  // if any shipping methods were received, then synchronize with the cart.
                  // Rules:
                  // 1. if the cart.shippingMethod matches one of the estimates, update the shippingHandling to keep costs in sync
                  // 2. if the cart.shippingMethod doesn't match an estimate, wipe it out and select the first estimate. (and apply rule #3)
                  // 3. if the cart.shippingMethod is not set, set it to the first estimate (always the cheapest).
                  var selectedMethod = app.data.cart.get('shippingMethod') || '';
                  if (selectedMethod) {
                    // make sure the costs match.  If there is a change in item count, etc, the costs could change.
                    var selectedEstimate = _.find(shippingEstimates, function (estimate) {
                      return estimate.name == selectedMethod;
                    });
                    if (selectedEstimate) {
                      app.data.cart.save({'shippingHandling': selectedEstimate.cost});
                    } else {
                      // the current shipping method wasn't found.  I need to remove the cart.shippingMethod
                      app.data.cart.save({'shippingMethod': null, 'shippingHandling': 0});
                      selectedMethod = null;
                    }
                  }

                  // this is not an if-else connected to the above logic because selectedMethod may change within the if statement,
                  // so this is evaluated separately.
                  if (!selectedMethod) {
                    app.data.cart.save({'shippingMethod': shippingEstimates[0].name, 'shippingHandling': shippingEstimates[0].cost});
                  }
                }

                app.data.shippingEstimates.reset(shippingEstimates);
                app.data.shippingEstimates.trigger('change');
              }
            }).always(function () {
              app.data.bootstrap.set({'fetchingShipping': false});
            });

  }
};


// ---------------------------------------------------------------------
// --- models and collections ---
// ---------------------------------------------------------------------
// Note: models are not 'defined'  They are created here by extending so
// that they have various helper functions, but as for the data dictionary,
// it is defined when the object is created.  So, every time one of these models
// is used, it will receive its data attributes.  The big advantage to having these
// models declared is so backbone will know what urls to use when syncing with the server.
// The urls are usually declared in the collections, and cascade to the individual models
// using a REST structure.
// Example:
//app.models.StoreFront = Backbone.Model.extend({idAttribute: "storeFrontOid"});


// a dummy model to track bootstrap data and handle events.
app.models.Bootstrap = Backbone.Model.extend();
app.models.Item = uc.models.NestedModel.extend({idAttribute: "position"});

app.collections.Items = uc.collections.NestedCollection.extend({
  model: app.models.Item,
  initialize: function () {
    this.comparator = function (model) {
      return [model.get("position")]
    };
  }
});

app.models.Cart = uc.models.DeepAndNestedModel.extend({
  'nested': [
    {'attributeName': 'items', 'collection': (new app.collections.Items())}
  ],
  idAttribute: "cartId",
  url: restUrl // restUrl is defined in the html page.
});

app.models.ShippingEstimate = Backbone.Model.extend({
  'idAttribute': 'name'
});

// this collection has NO url property since it's meant to be updated via a method that requires a cart.
app.collections.ShippingEstimates = Backbone.Collection.extend({
  model: app.models.ShippingEstimate
});

// ---------------------------------------------------------------------
// --- views ---
// ---------------------------------------------------------------------

// ---------------------------------------------------------------------
// --- Billing Address Fields ---
// ---------------------------------------------------------------------
app.views.BillingAddress = Backbone.View.extend({
  el: '#billToAddress',
  events: {
    "focus input[type=text]": 'selectText',
    'change input[type=text],input[type=number],input[type=email],select': 'copyFieldToCart'
  },

  'onClose': function () {
    this.model.off('sync reset addressCopy', this.render, this);
  },

  initialize: function () {
    this.model.on('sync reset addressCopy', this.render, this);
    _.bindAll(this);
  },

  render: function () {

    var countries = [];
    var cartCountry = this.model.get('billToCountry') || '';
    var masterList = app.data.bootstrap.get('countries');
    if (masterList) {
      _.each(masterList, function (country) {
        countries.push({country: country, selected: country == cartCountry })
      });
    }

    var context = {
      'countries': countries,
      'cart': this.model.attributes
    };

    this.$el.html(app.templates.billto(context));
    return this;

  },

  selectText: function (event) {
    jQuery(event.target).select();
  },

  'copyFieldToCart': function (event) {
    var fieldName = event.target.id;
    var value = jQuery.trim(jQuery(event.target).val());
    var changes = {};
    changes[fieldName] = value;
    this.model.set(changes);
  }


});


// ---------------------------------------------------------------------
// --- Shipping Address Fields ---
// ---------------------------------------------------------------------
app.views.ShippingAddress = Backbone.View.extend({
  el: '#shipToAddress',
  events: {
    'click #shippingIsBilling': 'showHideBilling',
    'focus input[type=text]': 'selectText',
    'change input[type=text],input[type=number],input[type=email]': 'copyFieldToCart'
  },

  'onClose': function () {
    this.model.off('sync reset', this.render, this);
  },

  initialize: function () {
    this.model.on('sync reset', this.render, this);
    _.bindAll(this);
  },

  render: function () {

    var countries = [];
    var cartCountry = this.model.get('shipToCountry') || '';
    var masterList = app.data.bootstrap.get('countries');
    if (masterList) {
      _.each(masterList, function (country) {
        countries.push({country: country, selected: country == cartCountry })
      });
    }

    var context = {
      'countries': countries,
      'cart': this.model.attributes,
      'shipToResidential': this.model.get('shipToResidential') || false // the custom handlebars helper I wrote doesn't work with nested properties (yet).
    };

    this.$el.html(app.templates.shipto(context));
    return this;

  },

  selectText: function (event) {
    jQuery(event.target).select();
  },

  'showHideBilling': function (event) {
    var checked = jQuery(event.target).is(':checked');
    app.commonFunctions.showHideBilling(!checked, true);
  },

  'copyFieldToCart': function (event) {
    var fieldName = event.target.id;
    var value = jQuery.trim(jQuery(event.target).val());
    var changes = {};

    // see if the billto should be updated too.
    var checked = jQuery('#shippingIsBilling').is(':checked');
    changes[fieldName] = value;

    if (checked && fieldName.substring(0, "shipTo".length) === "shipTo") {
      fieldName = "billTo" + fieldName.substring("shipTo".length);
      changes[fieldName] = value;
    }

    this.model.set(changes);
  }

});


// ---------------------------------------------------------------------
// --- Payment Fields ---
// ---------------------------------------------------------------------
app.views.Payment = Backbone.View.extend({
  el: '#payment',
  events: {
    'focus input[type=text]': 'selectText',
    'change input[type=text],input[type=number],input[type=email],select': 'copyFieldToCart'
  },

  'onClose': function () {
    this.model.off('sync reset', this.render, this);
  },

  initialize: function () {
    this.model.on('sync reset', this.render, this);
    _.bindAll(this);
  },

  render: function () {

    var ccType = this.model.get('creditCardType') || '';
    var ccExpMonth = this.model.get('creditCardExpirationMonth') || 0;
    var ccExpYear = this.model.get('creditCardExpirationYear') || 0;
    var sourceTypes = this.model.get('creditCardTypes') || ['AMEX', 'Discover', 'MasterCard', 'Visa' ];

    var ccTypes = [];
    _.each(sourceTypes, function (card) {
      ccTypes.push({card: card, selected: card == ccType });
    });
    var ccMonths = [
      {month: 1, name: 'January', selected: 1 == ccExpMonth},
      {month: 2, name: 'February', selected: 2 == ccExpMonth},
      {month: 3, name: 'March', selected: 3 == ccExpMonth},
      {month: 4, name: 'April', selected: 4 == ccExpMonth},
      {month: 5, name: 'May', selected: 5 == ccExpMonth},
      {month: 6, name: 'June', selected: 6 == ccExpMonth},
      {month: 7, name: 'July', selected: 7 == ccExpMonth},
      {month: 8, name: 'August', selected: 8 == ccExpMonth},
      {month: 9, name: 'September', selected: 9 == ccExpMonth},
      {month: 10, name: 'October', selected: 10 == ccExpMonth},
      {month: 11, name: 'November', selected: 11 == ccExpMonth},
      {month: 12, name: 'December', selected: 12 == ccExpMonth}
    ];

    var ccYears = [];
    for (var year = 2013; year < 2031; year++) {
      ccYears.push({year: year, selected: year == ccExpYear});
    }

    var context = {
      'ccTypes': ccTypes,
      'ccMonths': ccMonths,
      'ccYears': ccYears,
      'cart': this.model.attributes
    };

    this.$el.html(app.templates.payment(context));
    return this;

  },

  selectText: function (event) {
    jQuery(event.target).select();
  },

  'copyFieldToCart': function (event) {
    var fieldName = event.target.id;
    var value = jQuery.trim(jQuery(event.target).val());
    var changes = {};
    changes[fieldName] = value;
    this.model.set(changes);
  }

});


// ---------------------------------------------------------------------
// --- Items: Line Item ---
// ---------------------------------------------------------------------
app.views.Item = Backbone.View.extend({
  tagName: 'div',
  events: {
    "click .btnRemove": "itemRemove",
    "change .itemQty": "changeQuantity",
    "change .singleQualifier": "changeSingleQualifier",
    "change .multiQualifier": "changeMultiQualifier",
    "change .selectQualifier": "changeSelectQualifier",
    "click .radioQualifier": "changeRadioQualifier",
    "focus input[type=text]": "selectText"
  },

  'onClose': function () {
  },

  initialize: function () {
    _.bindAll(this);
  },

  render: function () {

    // this is going to seem like double-killing, but it's necessary.  I need to loop through the qualifiers
    // and set the selected value for drop downs to either the default or first value if it's empty.  then, i'll
    // clone the qualifiers and set a property to make a drop down box work.
    if (this.model.get('options')) {
      _.each(this.model.get('options'), function (optionValue) {

        // if the item has options, and the options is displays as a dropdown, and there is a list of dropdown values present, but nothing is selected yet
        // find either the default or first value and set it as the selected value.  This is necessary because the dropdowns do not have
        // blanks in them, so there's no way to trigger a 'change' event on the dropdown if the first value (or default) is desired.  so I have
        // to manually set it here.
        if (optionValue.type == 'dropdown' && !optionValue.selectedValue && optionValue.values && optionValue.values.length) {
          var defaultValue = _.find(optionValue.values, function (value) {
            return value.defaultValue; // boolean on each option value indicating if value is the default
          });
          if (defaultValue) {
            optionValue.selectedValue = defaultValue.value;
          } else {
            optionValue.selectedValue = optionValue.values[0].value;
          }
        }
      });

      var itemOptions = [];
      jQuery.extend(itemOptions, this.model.get('options') || []); // clone the qualifiers into a separate object

      // loop through and set a flag on a qualifier if it's currently selected.  makes the handlebars code workable.
      _.each(itemOptions, function (itemOption) {
        var selectedValue = itemOption.selectedValue || '';
        if (itemOption.values) {
          _.each(itemOption.values, function (value) {
            // first, see if there are any defaults that need to be set.  If there is a default, and no selected, set the selected to the default.
            if (!selectedValue && value.defaultValue) {
              value.selected = true;
            } else if (value.value == selectedValue) {
              value.selected = true;
            }
          });
        }
      });
    }


    var context = {
      'position': this.options.position,
      'itemId': this.model.get('itemId'),
      'description': this.model.get('description'),
      'quantity': this.model.get('quantity'),
      'unitCost': this.formatUnitCost(),
      'options': itemOptions,
      'imageUrl': this.model.get('defaultThumbnailUrl')
    };

    this.$el.html(app.templates.item(context));
    this.$el.addClass('item');
    if (this.options.position == 1) {
      this.$el.addClass('item-first');
    }
    if (this.options.position == this.options.totalItems) {
      this.$el.addClass('item-last');
    }
    this.$el.addClass(this.options.position % 2 == 0 ? "item-even" : "item-odd");

    return this;
  },

  selectText: function (event) {
    jQuery(event.target).select();
  },

  "itemRemove": function () {
    // normally, we'd call model.destroy, but this is a nested model, so we simply wish to call remove on the items collection
    // which will update the underlying items array on the cart object.
    app.data.cart.items.remove(this.model);
    // save the cart object, which will persist the removal of the item.
    app.data.cart.save();
  },

  'formatUnitCost': function () {

    var result = "";
    var unitCost = this.model.get('unitCost');
    if (unitCost) {
      result = parseFloat(unitCost);
      if (isNaN(result)) {
        result = 0;
      }
    } else {
      result = 0;
    }
    return result == 0 ? "Free" : accounting.formatMoney(result);
  },
  'changeQuantity': function (event) {
    var val = jQuery.trim(jQuery(event.target).val());
    var qty = parseInt(val);
    if (isNaN(qty)) {
      qty = 1;
    }

    this.model.set({'quantity': qty}, {'silent': true});
    app.data.cart.save();
  },
  'changeSingleQualifier': function (event) {
    this.changeQualifier(event, 'single');
  },
  'changeFixedQualifier': function (event) {
    this.changeQualifier(event, 'fixed');
  },
  'changeMultiQualifier': function (event) {
    this.changeQualifier(event, 'multi');
  },
  'changeSelectQualifier': function (event) {
    this.changeQualifier(event, 'select');
  },

  'changeQualifier': function (event, type) {
    // get the id, get the value
    // find the qualGroup, update it's selectedQualifier property
    // save the cart.
    var prefix = 'singleQualifier_';
    if (type == 'multi') {
      prefix = 'multiQualifier_';
    } else if (type == 'select') {
      prefix = 'selectQualifier_';
    } else if (type == 'fixed') {
      prefix = 'fixedQualifier_';
    }

    var id = uc.commonFunctions.parseOidFromId(event.target.id, prefix);
    var val = jQuery.trim(jQuery(event.target).val());

    var found = false;
    _.each((this.model.get('itemOptions') || []), function (itemOption) {
      if (itemOption.optionOid == id) {
        itemOption.selectedValue = val;
        found = true;
      }
    });
    if (found) {
      app.data.cart.save();
    }

  },
  'changeRadioQualifier': function (event) {
    // get the id, get the value
    // find the qualGroup, update it's selectedQualifier property
    // save the cart.
    var prefix = 'radioQualifier_';

    // notice I'm using the target.name and not target.id.  there are multiple radio buttons in a group. can't use id.
    var id = uc.commonFunctions.parseOidFromId(event.target.name, prefix);
    var val = jQuery.trim(jQuery(event.target).val());

    var found = false;
    _.each((this.model.get('itemOptions') || []), function (itemOption) {
      if (itemOption.optionOid == id) {
        itemOption.selectedValue = val;
        found = true;
      }
    });
    if (found) {
      app.data.cart.save();
    }
  }

});


// ---------------------------------------------------------------------
// --- Items ---
// ---------------------------------------------------------------------
app.views.Items = Backbone.View.extend({
  el: '#cart',
  childViews: [],
  events: {
  },

  'onClose': function () {
    this.collection.off('add sync remove reset change', this.render, this);
    this.closeChildren();
    // dispose of the children
    _.each(this.childViews, function (view) {
      view.close();
    });
  },

  initialize: function () {
    this.collection.on('add sync remove reset change', this.render, this);
    _.bindAll(this);
  },

  render: function () {

    var context = {};
    this.$el.html(app.templates.items(context));

    var that = this;

    // the first time, we don't need to do any clean up.  but subsequent render() calls need to close down any
    // existing views to avoid zombie event handlers.
    this.closeChildren();
    this.childViews = []; // re-init on each render so we capture any and all changed.

    var position = 1;
    this.collection.each(function (model) {
      if (model.get('kit')) {
        // skip the kit components to prevent them displaying.
      } else {
        // add the position to the context so we can number the items in the template.
        that.childViews.push(new app.views.Item({model: model, position: position, totalItems: that.collection.length}));
        position++;
      }
    });

    var footer = jQuery('footer', this.$el);
    _.each(this.childViews, function (view) {
      view.render();
      footer.before(view.el).before("<br class='clear'>"); // I don't like this. not elegant.  don't know of a better way.
    });

    return this;
  },


  'closeChildren': function () {
    _.each(this.childViews, function (view) {
      view.close();
    });
  }

});


// ---------------------------------------------------------------------
// --- Subtotal ---
// ---------------------------------------------------------------------
app.views.Subtotal = Backbone.View.extend({
  el: '#subtotal',
  events: {
    "click #continueShopping": "continueShopping"
  },

  'onClose': function () {
    this.model.off('sync reset change:subtotal', this.render, this);
  },

  initialize: function () {
    this.model.on('sync reset change:subtotal', this.render, this);
    _.bindAll(this);
  },

  render: function () {

    var context = {'subtotal': accounting.formatMoney(this.model.get('subtotal'))};
    this.$el.html(app.templates.subtotal(context));
    return this;
  },

  'continueShopping': function () {
    location.href = continueShoppingUrl;
  }

});


// ---------------------------------------------------------------------
// --- Shipping ---
// ---------------------------------------------------------------------
app.views.Shipping = Backbone.View.extend({
  el: '#shipping',
  events: {
    "click .inputShippingPreference": "selectShippingMethod",
    "change .selectShippingPreference": "selectShippingMethod"

  },
  priorItems: {}, // this is used to keep track of item changes.  since the cart items fire reset for each save, i need to know if the items actually changed
  // or infinite recursion could result.
  'onClose': function () {
    this.collection.off("change reset", this.render, this);
    app.data.cart.off("change:shipToPostalCode change:shipToCity change:shipToState change:shipToCountry", this.recalculateForDemographics, this);
    app.data.cart.off("change:shippingMethod", this.render, this);
    app.data.cart.items.off("change reset add remove", this.recalculateForItems, this);
  },

  initialize: function () {
    this.collection.on("change reset", this.render, this);
    app.data.cart.on("change:shipToPostalCode change:shipToCity change:shipToState change:shipToCountry", this.recalculateForDemographics, this);
    app.data.cart.on("change:shippingMethod", this.render, this);
    app.data.cart.items.on("change reset add remove", this.recalculateForItems, this);
    _.bindAll(this);

  },

  'showDropdown': false, // keep track of whether we showed a dropdown for shipping at any time to avoid switching on the customer.

  render: function () {
    var cart = app.data.cart.attributes;

    // create a copy of each model's attributes, and format the cost appropriately.
    var methods = [];
    _.each(app.data.shippingEstimates.models, function (model) {
      var cost = model.get('cost') == 0 ? "Free" : (accounting.formatMoney(model.get('cost') || 0));
      var method = _.clone(model.attributes);
      method['cost'] = cost; // overwrite the number with a formatted string.
      methods.push(method);
    });

    if (methods.length > 3 || this.showDropdown) {
      this.showDropdown = true;
    }

    var context = {
      'methods': methods,
      'noShippingMethods': this.collection.length == 0,
      'showDropdown': this.showDropdown,
      'selectedMethod': cart.shippingMethod
    };

    this.$el.html(app.templates.shipping(context));


    return this;
  },

  'selectShippingMethod': function (event) {
    var field = jQuery(event.target);
    var shippingMethodName = field.val();
    var model = this.collection.get(shippingMethodName);
    if (model) {

      var changes = {'shippingMethod': shippingMethodName, 'shippingHandling': model.get('cost')};
      // wipe out any previous settings for lift gate and third party if *this* method doesn't support them.

      // do a save instead of a set because this affects the totals.
      app.data.cart.save(changes);
    }
  },

  'recalculateForDemographics': function () {
    // do a recalc regardless of items, but store the current items.
    // try not to wait the first time this is called (page load).  after that, wait to give user time to finish entering fields.
    var firstTime = _.keys(this.priorItems).length > 0;
    this.priorItems = this.getCurrentItems();
    if (firstTime || app.data.cart && app.data.cart.get('shipToPostalCode') && app.data.cart.get('shipToCountry') && app.data.cart.get('shipToState')) {
      setTimeout(app.commonFunctions.estimateShipping, 1);
    }
  },

  'recalculateForItems': function () {
    var currentItems = this.getCurrentItems();
    if (!_.isEqual(this.priorItems, currentItems)) {
      this.priorItems = currentItems;
      setTimeout(app.commonFunctions.estimateShipping, 1);
    }
  },

  'getCurrentItems': function () {
    var currentItems = {};
    var items = app.data.cart.get('items');
    if (items) {
      _.each(app.data.cart.get('items'), function (item) {
        if (!currentItems.hasOwnProperty(item.itemId)) {
          currentItems[item.itemId] = 0;
        }
        currentItems[item.itemId] += item.quantity;
      });
    }
    return currentItems;
  }


});


// ---------------------------------------------------------------------
// --- Coupons ---
// ---------------------------------------------------------------------
app.views.Coupons = Backbone.View.extend({
  el: '#coupons',
  events: {
    "click #addCouponButton": "addCoupon",
    "click .removeCouponButton": "removeCoupon"
  },

  'onClose': function () {
    this.model.off("change:coupons sync reset", this.render, this);
  },

  initialize: function () {
    this.model.on("change:coupons sync reset", this.render, this);
    _.bindAll(this);

  },

  render: function () {
    var context = {
      'coupons': this.model.get('coupons') || []
    };

    this.$el.html(app.templates.coupons(context));
    return this;
  },

  'addCoupon': function (event) {
    event.stopPropagation();
    var couponCode = jQuery.trim(jQuery('#couponField').val());
    if (couponCode) {
      var coupons = app.data.cart.get('coupons') || [];
      coupons.push({'couponCode': couponCode});
      app.data.cart.save({'coupons': coupons});
    }
  },

  'removeCoupon': function (event) {
    var idx = uc.commonFunctions.parseOidFromId(event.target.id, 'couponRemove_');
    var coupons = app.data.cart.get('coupons') || [];
    if (coupons && coupons.length) {
      coupons.splice(idx, 1);
      app.data.cart.save({'coupons': coupons});
    }
  }

});


// ---------------------------------------------------------------------
// --- Gift Certificate ---
// ---------------------------------------------------------------------
app.views.GiftCertificate = Backbone.View.extend({
  el: '#giftCertificates',
  events: {
    "click #updateGiftCertificateButton": "updateGiftCertificate"
  },

  'onClose': function () {
    this.model.off("change:giftCertificate change:giftCertificateAmount change:giftCertificateRemainingBalanceAfterOrder sync reset", this.render, this);
  },

  initialize: function () {
    this.model.on("change:giftCertificate change:giftCertificateAmount change:giftCertificateRemainingBalanceAfterOrder sync reset", this.render, this);
    _.bindAll(this);

  },

  render: function () {

    var amount = this.model.get('giftCertificateAmount') || '';
    if (amount) {
      amount = amount.toFixed(2);
    }

    var remaining = this.model.get('giftCertificateRemainingBalanceAfterOrder') || '';
    if (remaining) {
      remaining = remaining.toFixed(2);
    }

    var context = {
      'giftCertificate': this.model.get('giftCertificate') || '',
      'giftCertificateAmount': amount,
      'giftCertificateRemainingBalanceAfterOrder': remaining
    };

    this.$el.html(app.templates.giftCertificate(context));
    return this;
  },

  'updateGiftCertificate': function (event) {
    event.stopPropagation();
    var button = jQuery(event.target);
    var text = button.text();
    var giftCertificate = jQuery.trim(jQuery('#giftCertificateField').val());
    if (text == 'Apply') {
      this.model.save({'giftCertificate': giftCertificate});
    } else {
      // if there is a gift cert, remove it.
      if (this.model.get('giftCertificate')) {
        this.model.save({'giftCertificate': ''});
      }
    }
  }

});


// ---------------------------------------------------------------------
// --- Summary Fields ---
// ---------------------------------------------------------------------
app.views.Summary = Backbone.View.extend({
  el: '#summary',
  events: {
  },

  'onClose': function () {
    this.model.off('sync reset change:subtotal change:buysafeBondCost change:buysafeBondAvailable change:tax change:shippingHandling change:total', this.render, this);
  },

  initialize: function () {
    this.model.on('sync reset change:subtotal change:buysafeBondCost change:buysafeBondAvailable change:tax change:shippingHandling change:total', this.render, this);
    _.bindAll(this);
  },

  render: function () {


    var buysafeBondCost = (this.model.get('buysafeBondCost') || 0) == 0 ? "Free!" : accounting.formatMoney(this.model.get('buysafeBondCost'));

    var context = {
      'beginScript': "<script type='text/javascript'>",
      'endScript': "</script>",
      'buysafeBondCost': buysafeBondCost,
      'showBuysafe': this.model.get('buysafeBondAvailable') || false,
      'buysafeBondWanted': this.model.get('buysafeBondWanted') || false,
      'buysafeScript': "<script type='text/javascript' src = '" + this.model.get('buysafeBondingSignalJavascript') + "'></script>",
      'buysafeBondingSignal': this.model.get('buysafeBondingSignal'),
      'buysafeCartDisplayText': this.model.get('buysafeCartDisplayText'),
      'buysafeCartDisplayUrl': this.model.get('buysafeCartDisplayUrl'),

      'subtotal': accounting.formatMoney(this.model.get('subtotal')),
      'tax': accounting.formatMoney(this.model.get('tax')),
      'shippingHandling': accounting.formatMoney(this.model.get('shippingHandling')),
      'total': accounting.formatMoney(this.model.get('total'))
    };

    this.$el.html(app.templates.summary(context));
    return this;

  }

});



// ---------------------------------------------------------------------
// --- Total Fields ---
// ---------------------------------------------------------------------
app.views.Google = Backbone.View.extend({
  el: '#google',
  events: {
    'click #.google_link': 'placeOrder'
  },

  'onClose': function () {
    this.model.off('add sync remove reset change', this.render, this);
  },

  initialize: function () {
    this.model.on('add sync remove reset change', this.render, this);
    _.bindAll(this);
  },

  render: function () {

    var showGoogle = this.model.get('hasGoogleCheckout') && this.model.get('googleCheckoutCompatible');
    var button = this.model.get('googleCheckoutButtonUrl') || 'images/google_checkout.gif';
    var alt = this.model.get('googleCheckoutButtonAltText') || "Google Checkout";

    this.$el.html(app.templates.google({'google': showGoogle, button: button, alt: alt}));
    return this;

  },

  placeOrder: function () {
    app.commonFunctions.checkout('Google Checkout');
  }

});


// ---------------------------------------------------------------------
// --- Total Fields ---
// ---------------------------------------------------------------------
app.views.Paypal = Backbone.View.extend({
  el: '#paypal',
  events: {
    'click .paypal_link': 'placeOrder'
  },

  'onClose': function () {
    this.model.off('add sync remove reset change', this.render, this);
  },

  initialize: function () {
    this.model.on('add sync remove reset change', this.render, this);
    _.bindAll(this);
  },

  render: function () {

    var showPaypal = this.model.get('hasPayPal') && this.model.get('payPalCompatible');
    var button = this.model.get('payPalButtonUrl') || 'images/paypal_checkout.gif';
    var alt = this.model.get('payPalButtonAltText') || "PayPal";

    this.$el.html(app.templates.paypal({'paypal': showPaypal, button: button, alt: alt}));
    return this;

  },

  placeOrder: function () {
    app.commonFunctions.checkout('PayPal');
  }

});

// ---------------------------------------------------------------------
// --- Total Fields ---
// ---------------------------------------------------------------------
app.views.Total = Backbone.View.extend({
  el: '#total',
  events: {
    'click #btnFinalize': 'placeOrder'
  },

  'onClose': function () {
    this.model.off('add sync remove reset change', this.render, this);
  },

  initialize: function () {
    this.model.on('add sync remove reset change', this.render, this);
    _.bindAll(this);
  },

  render: function () {

    this.$el.html(app.templates.total({}));
    return this;

  },

  placeOrder: function () {
    app.commonFunctions.checkout('Credit Card');
  }

});

// ---------------------------------------------------------------------
// --- operational code ---
// ---------------------------------------------------------------------


jQuery(document).ready(function () {

  // app.commonFunctions.enablePleaseWaitMessage();

  (new app.views.Items({collection: app.data.cart.items})).render();
  (new app.views.ShippingAddress({model: app.data.cart})).render();
  (new app.views.BillingAddress({model: app.data.cart})).render();
  (new app.views.Payment({model: app.data.cart})).render();
  (new app.views.Subtotal({model: app.data.cart})).render();
  (new app.views.Shipping({collection: app.data.shippingEstimates})).render();
  (new app.views.Coupons({model: app.data.cart})).render();
  (new app.views.GiftCertificate({model: app.data.cart})).render();
  (new app.views.Summary({model: app.data.cart})).render();
  (new app.views.Google({model: app.data.cart})).render();
  (new app.views.Paypal({model: app.data.cart})).render();
  (new app.views.Total({model: app.data.cart})).render();


  app.data.cart.fetch({
    headers: {
      'X-UC-Merchant-Id': window.merchantId,  // could also pass merchant id as query parameter named '_mid' or cookie named 'UltraCartMerchantId'
      // the cart id is not passed here as a header. to keep things simple, we'll rely on the cookie to pass in the cart id.
      "cache-control": "no-cache"
    },
    success: function (model) {
      var cartId = model.get('cartId') || false;
      if (cartId) {
        var cookieName = window.cartCookieName || 'UltraCartShoppingCartId';
        jQuery.cookie(cookieName, model.get('cartId'), { expires: 7, path: '/' });
        app.data.cart.trigger('sync');
      }
    }
  });

  // this will show any errors that are query parameters to the page.
  app.commonFunctions.displayServerErrors();
  app.commonFunctions.showHideBilling(/* no arguments */);

});

// bootstrap look up data so I can trigger events, especially for the asynchronously downloaded data.  The only
// downside to this is the backup copy backbone keeps.  Large data sets will now be 2x the size.
// most of the data is in fact, 'boot strapped' during the page load.  However, this is also a state control, and
// there are numerous fields not initialized below that are used throughout the program.  It's a great place to
// track state variables and trigger off them.
app.data.bootstrap = new app.models.Bootstrap({
  'merchantId': window.merchantId,
  'countries': ['United States'],
  'advertisingSources': [],
  'advertisingSourcesFreeForm': true,
  'taxCounties': [],
  'defaultCountry': 'United States'
});


app.data.shippingEstimates = new app.collections.ShippingEstimates(); // initially empty;

app.data.cart = new app.models.Cart({
  'country': app.data.bootstrap.get('defaultCountry'),
  'shipToCountry': app.data.bootstrap.get('defaultCountry')
});  // initially empty, except default countries.
