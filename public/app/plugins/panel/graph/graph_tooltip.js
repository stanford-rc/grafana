define([
  'jquery',
],
function ($) {
  'use strict';

  function GraphTooltip(elem, dashboard, scope, getSeriesFn) {
    var self = this;
    var ctrl = scope.ctrl;
    var panel = ctrl.panel;

    var $tooltip = $('<div id="tooltip">');

    this.findHoverIndexFromDataPoints = function(posX, series, last) {
      var ps = series.datapoints.pointsize;
      var initial = last*ps;
      var len = series.datapoints.points.length;
      for (var j = initial; j < len; j += ps) {
        if (series.datapoints.points[j] > posX) {
          return Math.max(j - ps,  0)/ps;
        }
      }
      return j/ps - 1;
    };

    this.findHoverIndexFromData = function(posX, series) {
      var len = series.data.length;
      for (var j = 0; j < len; j++) {
        if (series.data[j][0] > posX) {
          return Math.max(j - 1,  0);
        }
      }
      return j - 1;
    };

    this.showTooltip = function(absoluteTime, relativeTime, innerHtml, pos) {
      var body = '<div class="graph-tooltip small"><div class="graph-tooltip-time">'+ absoluteTime +
        ' <span class="tone-down">(' + relativeTime + ')</span></div> ';
      body += innerHtml + '</div>';
      $tooltip.html(body).place_tt(pos.pageX + 20, pos.pageY);
    };

    this.getMultiSeriesPlotHoverInfo = function(seriesList, pos) {
      var value, i, series, hoverIndex;
      var results = [];

      //now we know the current X (j) position for X and Y values
      var last_value = 0; //needed for stacked values

      for (i = 0; i < seriesList.length; i++) {
        series = seriesList[i];

        if (!series.data.length || (panel.legend.hideEmpty && series.allIsNull)) {
          results.push({ hidden: true });
          continue;
        }

        if (!series.data.length || (panel.legend.hideZero && series.allIsZero)) {
          results.push({ hidden: true });
          continue;
        }

        hoverIndex = this.findHoverIndexFromData(pos.x, series);
        results.time = series.data[hoverIndex][0];

        if (series.stack) {
          if (panel.tooltip.value_type === 'individual') {
            value = series.data[hoverIndex][1];
          } else if (!series.stack) {
            value = series.data[hoverIndex][1];
          } else {
            last_value += series.data[hoverIndex][1];
            value = last_value;
          }
        } else {
          value = series.data[hoverIndex][1];
        }

        // Highlighting multiple Points depending on the plot type
        if (series.lines.steps || series.stack) {
          // stacked and steppedLine plots can have series with different length.
          // Stacked series can increase its length on each new stacked serie if null points found,
          // to speed the index search we begin always on the last found hoverIndex.
          var newhoverIndex = this.findHoverIndexFromDataPoints(pos.x, series, hoverIndex);
          results.push({ value: value, hoverIndex: newhoverIndex });
        } else {
          results.push({ value: value, hoverIndex: hoverIndex });
        }
      }

      return results;
    };

    elem.mouseleave(function () {
      if (panel.tooltip.shared) {
        var plot = elem.data().plot;
        if (plot) {
          $tooltip.detach();
          plot.unhighlight();
        }
      }

      if (dashboard.sharedCrosshair) {
        ctrl.publishAppEvent('clearCrosshair');
      }
    });

    elem.bind("plothover", function (event, pos, item) {
      var plot = elem.data().plot;
      var plotData = plot.getData();
      var seriesList = getSeriesFn();
      var group, value, absoluteTime, relativeTime, hoverInfo, i, series, seriesHtml, tooltipFormat;

      if (panel.tooltip.msResolution) {
        tooltipFormat = 'YYYY-MM-DD HH:mm:ss.SSS';
      } else {
        tooltipFormat = 'YYYY-MM-DD HH:mm:ss';
      }

      if (dashboard.sharedCrosshair) {
        ctrl.publishAppEvent('setCrosshair', { pos: pos, scope: scope });
      }

      if (seriesList.length === 0) {
        return;
      }

      if (panel.tooltip.shared) {
        plot.unhighlight();

        var seriesHoverInfo = self.getMultiSeriesPlotHoverInfo(plotData, pos);

        seriesHtml = '';

        relativeTime = dashboard.getRelativeTime(seriesHoverInfo.time);
        absoluteTime = dashboard.formatDate(seriesHoverInfo.time, tooltipFormat);

        for (i = 0; i < seriesHoverInfo.length; i++) {
          hoverInfo = seriesHoverInfo[i];

          if (hoverInfo.hidden) {
            continue;
          }

          series = seriesList[i];

          value = series.formatValue(hoverInfo.value);

          seriesHtml += '<div class="graph-tooltip-list-item"><div class="graph-tooltip-series-name">';
          seriesHtml += '<i class="fa fa-minus" style="color:' + series.color +';"></i> ' + series.label + ':</div>';
          seriesHtml += '<div class="graph-tooltip-value">' + value + '</div></div>';
          plot.highlight(i, hoverInfo.hoverIndex);
        }

        self.showTooltip(absoluteTime, relativeTime, seriesHtml, pos);
      }
      // single series tooltip
      else if (item) {
        series = seriesList[item.seriesIndex];
        group = '<div class="graph-tooltip-list-item"><div class="graph-tooltip-series-name">';
        group += '<i class="fa fa-minus" style="color:' + item.series.color +';"></i> ' + series.label + ':</div>';

        if (panel.stack && panel.tooltip.value_type === 'individual') {
          value = item.datapoint[1] - item.datapoint[2];
        }
        else {
          value = item.datapoint[1];
        }

        value = series.formatValue(value);

        relativeTime = dashboard.getRelativeTime(item.datapoint[0]);
        absoluteTime = dashboard.formatDate(item.datapoint[0], tooltipFormat);

        group += '<div class="graph-tooltip-value">' + value + '</div>';

        self.showTooltip(absoluteTime, relativeTime, group, pos);
      }
      // no hit
      else {
        $tooltip.detach();
      }
    });
  }

  return GraphTooltip;
});
