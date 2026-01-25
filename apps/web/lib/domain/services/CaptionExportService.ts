/**
 * Caption Export Service (Domain Layer)
 *
 * Domain service for exporting captions in multiple formats.
 * Supports SRT, WebVTT, and JSON with optional styling metadata.
 *
 * @module CaptionExportService
 */

import { injectable } from 'inversify';
import { logger } from '@/lib/logger';
import { AppError } from '@/lib/utils/error-handler';
import { parseSRT, buildSRT, buildVTT, CaptionEntry } from '@/lib/srt-utils';
import type { CaptionStyleId, AggressivenessValue } from '@/lib/constants/caption-styles';

export type CaptionExportFormat = 'srt' | 'vtt' | 'json';

export interface CaptionExportOptions {
  format: CaptionExportFormat;
  includeStyle?: boolean;
  styleId?: CaptionStyleId;
  aggressiveness?: AggressivenessValue;
}

export interface CaptionExportResult {
  content: string;
  filename: string;
  mimeType: string;
}

export interface JSONCaptionEntry extends CaptionEntry {
  style?: {
    styleId?: CaptionStyleId;
    aggressiveness?: AggressivenessValue;
  };
}

@injectable()
export class CaptionExportService {
  /**
   * Export captions in the specified format
   *
   * @param srtContent - SRT formatted caption string
   * @param clipId - Clip ID for filename generation
   * @param options - Export options
   * @returns Export result with content, filename, and MIME type
   */
  async exportCaptions(
    srtContent: string,
    clipId: string,
    options: CaptionExportOptions
  ): Promise<CaptionExportResult> {
    if (!srtContent) {
      throw AppError.badRequest('No captions available to export');
    }

    logger.info('Exporting captions', {
      clipId,
      format: options.format,
      includeStyle: options.includeStyle,
    });

    // Parse SRT content to caption entries
    const entries = parseSRT(srtContent);

    if (entries.length === 0) {
      throw AppError.badRequest('Invalid caption format - no entries found');
    }

    // Generate export based on format
    switch (options.format) {
      case 'srt':
        return this.exportAsSRT(entries, clipId);

      case 'vtt':
        return this.exportAsVTT(entries, clipId);

      case 'json':
        return this.exportAsJSON(entries, clipId, options);

      default:
        throw AppError.badRequest(`Unsupported export format: ${options.format}`);
    }
  }

  /**
   * Export as SRT format
   */
  private exportAsSRT(entries: CaptionEntry[], clipId: string): CaptionExportResult {
    const content = buildSRT(entries);

    logger.info('Exported captions as SRT', {
      clipId,
      entryCount: entries.length,
    });

    return {
      content,
      filename: `captions-${clipId}.srt`,
      mimeType: 'application/x-subrip',
    };
  }

  /**
   * Export as WebVTT format
   */
  private exportAsVTT(entries: CaptionEntry[], clipId: string): CaptionExportResult {
    const content = buildVTT(entries);

    logger.info('Exported captions as WebVTT', {
      clipId,
      entryCount: entries.length,
    });

    return {
      content,
      filename: `captions-${clipId}.vtt`,
      mimeType: 'text/vtt',
    };
  }

  /**
   * Export as JSON format with optional styling metadata
   */
  private exportAsJSON(
    entries: CaptionEntry[],
    clipId: string,
    options: CaptionExportOptions
  ): CaptionExportResult {
    const jsonEntries: JSONCaptionEntry[] = entries.map((entry) => {
      const jsonEntry: JSONCaptionEntry = { ...entry };

      // Include style metadata if requested
      if (options.includeStyle) {
        jsonEntry.style = {
          styleId: options.styleId,
          aggressiveness: options.aggressiveness,
        };
      }

      return jsonEntry;
    });

    const content = JSON.stringify(
      {
        clipId,
        captions: jsonEntries,
        metadata: {
          totalEntries: jsonEntries.length,
          exportedAt: new Date().toISOString(),
          format: 'json',
          ...(options.includeStyle && {
            style: {
              styleId: options.styleId,
              aggressiveness: options.aggressiveness,
            },
          }),
        },
      },
      null,
      2
    );

    logger.info('Exported captions as JSON', {
      clipId,
      entryCount: entries.length,
      includeStyle: options.includeStyle,
    });

    return {
      content,
      filename: `captions-${clipId}.json`,
      mimeType: 'application/json',
    };
  }
}
